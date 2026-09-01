/**
 * Skill graph thuần (không phụ thuộc pg). Một cạnh (prerequisite -> skill) nghĩa là
 * kỹ năng `prerequisite` phải nắm trước kỹ năng `skill`. Đồ thị phải là DAG hợp lệ
 * trước khi được duyệt; chẩn đoán và lộ trình ôn tập (Phase 4B/4C) chỉ chạy trên
 * đồ thị đã duyệt.
 */
export interface SkillNode {
  code: string;
  name: string;
  description?: string;
}

export interface SkillEdge {
  /** Kỹ năng tiên quyết, phải học trước. */
  prerequisite: string;
  /** Kỹ năng phụ thuộc vào tiên quyết. */
  skill: string;
}

export interface SkillGraphDefinition {
  skills: SkillNode[];
  edges: SkillEdge[];
}

export interface SkillGraphValidation {
  valid: boolean;
  errors: string[];
}

const SKILL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/;

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
}

/** Chuẩn hóa jsonb tùy ý thành định nghĩa có kiểu; bỏ qua phần dư thừa, không ném lỗi. */
export function normalizeSkillGraphDefinition(raw: unknown): SkillGraphDefinition {
  const root = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const skills = asRecordArray(root.skills).map((skill) => {
    const node: SkillNode = {
      code: typeof skill.code === 'string' ? skill.code.trim() : '',
      name: typeof skill.name === 'string' ? skill.name.trim() : '',
    };
    if (typeof skill.description === 'string' && skill.description.trim()) node.description = skill.description.trim();
    return node;
  });
  const edges = asRecordArray(root.edges).map((edge) => ({
    prerequisite: typeof edge.prerequisite === 'string' ? edge.prerequisite.trim() : '',
    skill: typeof edge.skill === 'string' ? edge.skill.trim() : '',
  }));
  return { skills, edges };
}

/** Kiểm tra toàn vẹn: mã hợp lệ, không trùng, cạnh trỏ đúng kỹ năng, không tự lặp, không có chu trình. */
export function validateSkillGraphDefinition(definition: SkillGraphDefinition): SkillGraphValidation {
  const errors: string[] = [];
  if (definition.skills.length === 0) errors.push('Đồ thị kỹ năng cần ít nhất một kỹ năng.');
  if (definition.skills.length > 500) errors.push('Đồ thị kỹ năng không được vượt quá 500 kỹ năng.');

  const seen = new Set<string>();
  for (const skill of definition.skills) {
    if (!skill.code || !SKILL_CODE_PATTERN.test(skill.code)) errors.push(`Mã kỹ năng không hợp lệ: "${skill.code}".`);
    if (!skill.name || skill.name.length > 200) errors.push(`Tên kỹ năng không hợp lệ cho mã "${skill.code}".`);
    const key = skill.code.toLocaleLowerCase('vi-VN');
    if (seen.has(key)) errors.push(`Mã kỹ năng bị trùng: "${skill.code}".`);
    seen.add(key);
  }

  const codes = new Set(definition.skills.map((skill) => skill.code));
  const edgeKeys = new Set<string>();
  for (const edge of definition.edges) {
    if (!codes.has(edge.prerequisite)) errors.push(`Cạnh tham chiếu kỹ năng tiên quyết không tồn tại: "${edge.prerequisite}".`);
    if (!codes.has(edge.skill)) errors.push(`Cạnh tham chiếu kỹ năng không tồn tại: "${edge.skill}".`);
    if (edge.prerequisite === edge.skill) errors.push(`Kỹ năng không thể là tiên quyết của chính nó: "${edge.skill}".`);
    const edgeKey = `${edge.prerequisite}\u0000${edge.skill}`;
    if (edgeKeys.has(edgeKey)) errors.push(`Cạnh bị trùng: "${edge.prerequisite}" → "${edge.skill}".`);
    edgeKeys.add(edgeKey);
  }

  if (errors.length === 0 && detectCycle(definition)) {
    errors.push('Đồ thị kỹ năng chứa chu trình tiên quyết; hãy loại bỏ vòng lặp.');
  }
  return { valid: errors.length === 0, errors };
}

/** Trả về true nếu tồn tại chu trình theo cạnh tiên quyết. */
export function detectCycle(definition: SkillGraphDefinition): boolean {
  const adjacency = buildAdjacency(definition);
  const state = new Map<string, 'visiting' | 'done'>();
  const walk = (node: string): boolean => {
    const current = state.get(node);
    if (current === 'visiting') return true;
    if (current === 'done') return false;
    state.set(node, 'visiting');
    for (const next of adjacency.get(node) ?? []) if (walk(next)) return true;
    state.set(node, 'done');
    return false;
  };
  for (const skill of definition.skills) if (walk(skill.code)) return true;
  return false;
}

/**
 * Thứ tự tô-pô (Kahn): tiên quyết đứng trước kỹ năng phụ thuộc. Ném lỗi nếu có chu trình,
 * nên chỉ gọi sau khi validate thành công.
 */
export function topologicalOrder(definition: SkillGraphDefinition): string[] {
  const adjacency = buildAdjacency(definition);
  const indegree = new Map<string, number>();
  for (const skill of definition.skills) indegree.set(skill.code, 0);
  for (const targets of adjacency.values()) for (const target of targets) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  // Hàng đợi ổn định theo thứ tự khai báo kỹ năng để kết quả tất định.
  const ready = definition.skills.map((skill) => skill.code).filter((code) => (indegree.get(code) ?? 0) === 0);
  const order: string[] = [];
  while (ready.length > 0) {
    const code = ready.shift()!;
    order.push(code);
    for (const next of adjacency.get(code) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) ready.push(next);
    }
  }
  if (order.length !== definition.skills.length) throw new Error('Không thể sắp thứ tự đồ thị có chu trình.');
  return order;
}

/** Danh sách kỹ năng tiên quyết trực tiếp của một kỹ năng. */
export function directPrerequisites(definition: SkillGraphDefinition, skillCode: string): string[] {
  return definition.edges.filter((edge) => edge.skill === skillCode).map((edge) => edge.prerequisite);
}

/** Tất cả kỹ năng hạ nguồn (phụ thuộc trực tiếp/gián tiếp) của một kỹ năng. */
export function downstreamSkills(definition: SkillGraphDefinition, skillCode: string): string[] {
  const adjacency = buildAdjacency(definition);
  const visited = new Set<string>();
  const stack = [...(adjacency.get(skillCode) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (visited.has(next)) continue;
    visited.add(next);
    for (const child of adjacency.get(next) ?? []) if (!visited.has(child)) stack.push(child);
  }
  return [...visited].sort();
}

function buildAdjacency(definition: SkillGraphDefinition): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const skill of definition.skills) adjacency.set(skill.code, []);
  for (const edge of definition.edges) {
    if (!adjacency.has(edge.prerequisite)) adjacency.set(edge.prerequisite, []);
    adjacency.get(edge.prerequisite)!.push(edge.skill);
  }
  return adjacency;
}
