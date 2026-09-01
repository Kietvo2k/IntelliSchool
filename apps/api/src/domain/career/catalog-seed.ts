import { defaultBlocksForMajor } from './exam-blocks-2025.js';

export interface CatalogMajorSeed {
  code: string;
  name: string;
  careerCode?: string;
  group?: 'khtn' | 'khxh' | 'both';
}

export interface CatalogInstitutionSeed {
  code: string;
  name: string;
  province: string;
  type: 'UNIVERSITY';
  website: string;
  description: string;
  majors: Array<{ majorCode: string; score?: number; sourceUrl: string }>;
}

export const CATALOG_MAJORS: readonly CatalogMajorSeed[] = [
  { code: 'CS', name: 'Khoa học máy tính', careerCode: 'SOFTWARE_ENGINEER', group: 'khtn' },
  { code: 'MED', name: 'Y khoa', careerCode: 'MEDICAL_DOCTOR', group: 'khtn' },
  { code: '7480201', name: 'Công nghệ thông tin', careerCode: 'SOFTWARE_ENGINEER', group: 'khtn' },
  { code: '7480101', name: 'Khoa học máy tính (GDĐT)', careerCode: 'SOFTWARE_ENGINEER', group: 'khtn' },
  { code: '7480202', name: 'An toàn thông tin', careerCode: 'SOFTWARE_ENGINEER', group: 'khtn' },
  { code: '7460101', name: 'Toán học', careerCode: 'DATA_ANALYST', group: 'khtn' },
  { code: '7440101', name: 'Vật lý học', careerCode: 'ENVIRONMENTAL_SCIENTIST', group: 'khtn' },
  { code: '7520201', name: 'Kỹ thuật điện', careerCode: 'CIVIL_ENGINEER', group: 'khtn' },
  { code: '7520113', name: 'Kỹ thuật cơ khí', careerCode: 'CIVIL_ENGINEER', group: 'khtn' },
  { code: '7580201', name: 'Kỹ thuật xây dựng', careerCode: 'CIVIL_ENGINEER', group: 'khtn' },
  { code: '7580101', name: 'Kiến trúc', careerCode: 'ARCHITECT', group: 'khtn' },
  { code: '7720101', name: 'Y khoa (GDĐT)', careerCode: 'MEDICAL_DOCTOR', group: 'khtn' },
  { code: '7720201', name: 'Dược học', careerCode: 'PHARMACIST', group: 'khtn' },
  { code: '7720301', name: 'Điều dưỡng', careerCode: 'NURSE', group: 'khtn' },
  { code: '7340101', name: 'Quản trị kinh doanh', careerCode: 'ENTREPRENEUR', group: 'both' },
  { code: '7340120', name: 'Kinh doanh quốc tế', careerCode: 'MARKETING_MANAGER', group: 'both' },
  { code: '7340115', name: 'Marketing', careerCode: 'MARKETING_MANAGER', group: 'both' },
  { code: '7310101', name: 'Kinh tế', careerCode: 'BANKER', group: 'khxh' },
  { code: '7380101', name: 'Luật', careerCode: 'LAWYER', group: 'khxh' },
  { code: '7380103', name: 'Luật quốc tế', careerCode: 'LAWYER', group: 'khxh' },
  { code: '7380107', name: 'Luật kinh tế', careerCode: 'LAWYER', group: 'khxh' },
  { code: '7220201', name: 'Ngôn ngữ Anh', careerCode: 'TEACHER', group: 'khxh' },
  { code: '7140209', name: 'Sư phạm Toán học', careerCode: 'TEACHER', group: 'khtn' },
  { code: '7140231', name: 'Sư phạm Ngữ văn', careerCode: 'TEACHER', group: 'khxh' },
  { code: '7140234', name: 'Sư phạm Tiếng Anh', careerCode: 'TEACHER', group: 'khxh' },
  { code: '7320101', name: 'Truyền thông đa phương tiện', careerCode: 'JOURNALIST', group: 'khxh' },
  { code: '7510302', name: 'Viễn thông', careerCode: 'SOFTWARE_ENGINEER', group: 'khtn' },
  { code: '7520114', name: 'Kỹ thuật cơ điện tử', careerCode: 'CIVIL_ENGINEER', group: 'khtn' },
  { code: '7310103', name: 'Nhân học', careerCode: 'PSYCHOLOGIST', group: 'khxh' },
];

const SRC = 'https://moet.gov.vn';

export const CATALOG_INSTITUTIONS: readonly CatalogInstitutionSeed[] = [
  { code: 'DUT', name: 'Đại học Bách khoa - Đại học Đà Nẵng', province: 'Đà Nẵng', type: 'UNIVERSITY', website: 'https://dut.udn.vn', description: 'Trường kỹ thuật hàng đầu miền Trung.', majors: [{ majorCode: 'CS', score: 25.5, sourceUrl: 'https://example.test/catalog' }, { majorCode: '7480201', score: 25.5, sourceUrl: SRC }] },
  { code: 'VNU_HN', name: 'Đại học Quốc gia Hà Nội', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://vnu.edu.vn', description: 'Đại học quốc gia tại Hà Nội.', majors: [{ majorCode: '7480201', score: 27.5, sourceUrl: SRC }, { majorCode: '7480101', score: 27.8, sourceUrl: SRC }, { majorCode: '7460101', score: 25, sourceUrl: SRC }] },
  { code: 'HUST', name: 'Đại học Bách khoa Hà Nội', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://hust.edu.vn', description: 'Trường kỹ thuật hàng đầu miền Bắc.', majors: [{ majorCode: '7480201', score: 27.5, sourceUrl: SRC }, { majorCode: '7480101', score: 28, sourceUrl: SRC }, { majorCode: '7520201', score: 25.5, sourceUrl: SRC }] },
  { code: 'NEU', name: 'Đại học Kinh tế Quốc dân', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://neu.edu.vn', description: 'Trường kinh tế công lập.', majors: [{ majorCode: '7340101', score: 27, sourceUrl: SRC }, { majorCode: '7310101', score: 26.5, sourceUrl: SRC }, { majorCode: '7340115', score: 26, sourceUrl: SRC }] },
  { code: 'FTU', name: 'Đại học Ngoại thương', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://ftu.edu.vn', description: 'Trường ngoại thương công lập.', majors: [{ majorCode: '7340120', score: 28.2, sourceUrl: SRC }, { majorCode: '7380103', score: 25.5, sourceUrl: SRC }, { majorCode: '7220201', score: 24, sourceUrl: SRC }] },
  { code: 'HNUE', name: 'Đại học Sư phạm Hà Nội', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://hnue.edu.vn', description: 'Trường sư phạm công lập.', majors: [{ majorCode: '7140209', score: 26.5, sourceUrl: SRC }, { majorCode: '7140231', score: 26, sourceUrl: SRC }, { majorCode: '7140234', score: 25.5, sourceUrl: SRC }] },
  { code: 'HMU', name: 'Đại học Y Hà Nội', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://hmu.edu.vn', description: 'Trường y khoa công lập.', majors: [{ majorCode: '7720101', score: 28.5, sourceUrl: SRC }, { majorCode: '7720201', score: 27, sourceUrl: SRC }, { majorCode: '7720301', score: 22, sourceUrl: SRC }] },
  { code: 'PTIT', name: 'Học viện Bưu chính Viễn thông', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://ptit.edu.vn', description: 'Học viện công nghệ thông tin và viễn thông.', majors: [{ majorCode: '7480201', score: 26, sourceUrl: SRC }, { majorCode: '7480202', score: 26, sourceUrl: SRC }, { majorCode: '7510302', score: 24, sourceUrl: SRC }] },
  { code: 'HTC', name: 'Học viện Tài chính', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://hvtc.edu.vn', description: 'Học viện tài chính công lập.', majors: [{ majorCode: '7310101', score: 26, sourceUrl: SRC }, { majorCode: '7340101', score: 25.5, sourceUrl: SRC }] },
  { code: 'HVNH', name: 'Học viện Ngân hàng', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://hvnh.edu.vn', description: 'Học viện ngân hàng công lập.', majors: [{ majorCode: '7310101', score: 25.5, sourceUrl: SRC }, { majorCode: '7340101', score: 25, sourceUrl: SRC }] },
  { code: 'TMU', name: 'Đại học Thương mại', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://tmu.edu.vn', description: 'Trường thương mại công lập.', majors: [{ majorCode: '7340101', score: 25, sourceUrl: SRC }, { majorCode: '7340115', score: 24.5, sourceUrl: SRC }] },
  { code: 'HAUI', name: 'Đại học Công nghiệp Hà Nội', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://haui.edu.vn', description: 'Trường công nghiệp công lập.', majors: [{ majorCode: '7480201', score: 25, sourceUrl: SRC }, { majorCode: '7520114', score: 24.5, sourceUrl: SRC }] },
  { code: 'HAU', name: 'Đại học Kiến trúc Hà Nội', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://hau.edu.vn', description: 'Trường kiến trúc công lập.', majors: [{ majorCode: '7580101', score: 23, sourceUrl: SRC }, { majorCode: '7580201', score: 22.5, sourceUrl: SRC }] },
  { code: 'FPT', name: 'Đại học FPT', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://fpt.edu.vn', description: 'Trường đại học tư thục.', majors: [{ majorCode: '7480201', score: 21, sourceUrl: SRC }, { majorCode: '7480101', score: 21.5, sourceUrl: SRC }, { majorCode: '7340115', score: 20, sourceUrl: SRC }] },
  { code: 'VNU_HCM', name: 'Đại học Quốc gia TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://vnuhcm.edu.vn', description: 'Đại học quốc gia tại TP.HCM.', majors: [{ majorCode: '7480201', score: 27, sourceUrl: SRC }, { majorCode: '7380101', score: 25.5, sourceUrl: SRC }, { majorCode: '7310101', score: 26, sourceUrl: SRC }] },
  { code: 'HCMUT', name: 'Đại học Bách khoa TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://hcmut.edu.vn', description: 'Trường kỹ thuật miền Nam.', majors: [{ majorCode: '7480201', score: 27, sourceUrl: SRC }, { majorCode: '7520113', score: 25, sourceUrl: SRC }, { majorCode: '7580201', score: 24.5, sourceUrl: SRC }] },
  { code: 'UEH', name: 'Đại học Kinh tế TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://ueh.edu.vn', description: 'Trường kinh tế miền Nam.', majors: [{ majorCode: '7340101', score: 26.5, sourceUrl: SRC }, { majorCode: '7310101', score: 26, sourceUrl: SRC }] },
  { code: 'FTU2', name: 'Đại học Ngoại thương cơ sở 2', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://cs2.ftu.edu.vn', description: 'Cơ sở TP.HCM của Đại học Ngoại thương.', majors: [{ majorCode: '7340120', score: 27.5, sourceUrl: SRC }, { majorCode: '7220201', score: 23.5, sourceUrl: SRC }] },
  { code: 'HCMUS', name: 'Đại học Khoa học Tự nhiên TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://hcmus.edu.vn', description: 'Trường khoa học tự nhiên.', majors: [{ majorCode: '7480101', score: 26.5, sourceUrl: SRC }, { majorCode: '7460101', score: 24.5, sourceUrl: SRC }] },
  { code: 'UIT', name: 'Đại học Công nghệ thông tin TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://uit.edu.vn', description: 'Trường CNTT thuộc ĐHQG TP.HCM.', majors: [{ majorCode: '7480201', score: 27.2, sourceUrl: SRC }, { majorCode: '7480202', score: 26.8, sourceUrl: SRC }] },
  { code: 'HCMUTE', name: 'Đại học Sư phạm Kỹ thuật TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://hcmute.edu.vn', description: 'Trường sư phạm kỹ thuật.', majors: [{ majorCode: '7480201', score: 25, sourceUrl: SRC }, { majorCode: '7520113', score: 24, sourceUrl: SRC }] },
  { code: 'UMP', name: 'Đại học Y Dược TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://ump.edu.vn', description: 'Trường y dược miền Nam.', majors: [{ majorCode: '7720101', score: 27.8, sourceUrl: SRC }, { majorCode: '7720201', score: 26.5, sourceUrl: SRC }] },
  { code: 'TDTU', name: 'Đại học Tôn Đức Thắng', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://tdtu.edu.vn', description: 'Trường đại học công lập định hướng ứng dụng.', majors: [{ majorCode: '7480201', score: 24, sourceUrl: SRC }, { majorCode: '7340101', score: 23.5, sourceUrl: SRC }] },
  { code: 'RMIT', name: 'Đại học RMIT Việt Nam', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://rmit.edu.vn', description: 'Trường quốc tế. Điểm chuẩn THPT không công bố trên nguồn này.', majors: [{ majorCode: '7340115', sourceUrl: SRC }, { majorCode: '7340101', sourceUrl: SRC }] },
  { code: 'HUEUNI', name: 'Đại học Huế', province: 'Thừa Thiên Huế', type: 'UNIVERSITY', website: 'https://hueuni.edu.vn', description: 'Đại học vùng miền Trung.', majors: [{ majorCode: '7720301', score: 22, sourceUrl: SRC }, { majorCode: '7380101', score: 22.5, sourceUrl: SRC }] },
  { code: 'UDN', name: 'Đại học Đà Nẵng', province: 'Đà Nẵng', type: 'UNIVERSITY', website: 'https://udn.vn', description: 'Đại học vùng Đà Nẵng.', majors: [{ majorCode: '7480201', score: 25.5, sourceUrl: SRC }, { majorCode: '7380107', score: 24, sourceUrl: SRC }, { majorCode: '7340101', score: 24.5, sourceUrl: SRC }] },
  { code: 'ULIS', name: 'Đại học Ngoại ngữ - ĐHQG Hà Nội', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://ulis.vnu.edu.vn', description: 'Trường ngoại ngữ thuộc ĐHQGHN.', majors: [{ majorCode: '7220201', score: 25, sourceUrl: SRC }] },
  { code: 'HUMG', name: 'Đại học Mỏ - Địa chất', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://humg.edu.vn', description: 'Trường kỹ thuật tài nguyên.', majors: [{ majorCode: '7520201', score: 22, sourceUrl: SRC }, { majorCode: '7580201', score: 21.5, sourceUrl: SRC }] },
  { code: 'UTC', name: 'Đại học Giao thông vận tải', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://utc.edu.vn', description: 'Trường giao thông vận tải.', majors: [{ majorCode: '7580201', score: 23, sourceUrl: SRC }, { majorCode: '7520113', score: 22.5, sourceUrl: SRC }] },
  { code: 'HLU', name: 'Đại học Luật Hà Nội', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://hlu.edu.vn', description: 'Trường luật công lập.', majors: [{ majorCode: '7380101', score: 26, sourceUrl: SRC }, { majorCode: '7380107', score: 25.5, sourceUrl: SRC }] },
  { code: 'VINUNI', name: 'Đại học VinUni', province: 'Hà Nội', type: 'UNIVERSITY', website: 'https://vinuni.edu.vn', description: 'Trường đại học tư thục.', majors: [{ majorCode: '7480201', score: 22, sourceUrl: SRC }, { majorCode: '7340101', score: 21, sourceUrl: SRC }] },
  { code: 'UEL', name: 'Đại học Kinh tế - Luật', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://uel.edu.vn', description: 'Trường kinh tế luật thuộc ĐHQG TP.HCM.', majors: [{ majorCode: '7340101', score: 25.5, sourceUrl: SRC }, { majorCode: '7380101', score: 25, sourceUrl: SRC }] },
  { code: 'HCMUSSH', name: 'Đại học Khoa học Xã hội và Nhân văn TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://hcmussh.edu.vn', description: 'Trường khoa học xã hội.', majors: [{ majorCode: '7220201', score: 23, sourceUrl: SRC }, { majorCode: '7320101', score: 22.5, sourceUrl: SRC }] },
  { code: 'NLU', name: 'Đại học Nông Lâm TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://hcmuaf.edu.vn', description: 'Trường nông lâm.', majors: [{ majorCode: '7480201', score: 22, sourceUrl: SRC }, { majorCode: '7520113', score: 21.5, sourceUrl: SRC }] },
  { code: 'CTU', name: 'Đại học Cần Thơ', province: 'Cần Thơ', type: 'UNIVERSITY', website: 'https://ctu.edu.vn', description: 'Đại học vùng Đồng bằng sông Cửu Long.', majors: [{ majorCode: '7480201', score: 23, sourceUrl: SRC }, { majorCode: '7720301', score: 21, sourceUrl: SRC }, { majorCode: '7140209', score: 22, sourceUrl: SRC }] },
  { code: 'VLU', name: 'Đại học Văn Lang', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://vanlanguni.edu.vn', description: 'Trường đại học tư thục.', majors: [{ majorCode: '7340115', score: 18, sourceUrl: SRC }, { majorCode: '7480201', score: 19, sourceUrl: SRC }] },
  { code: 'IUH', name: 'Đại học Công nghiệp TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://iuh.edu.vn', description: 'Trường công nghiệp.', majors: [{ majorCode: '7480201', score: 23, sourceUrl: SRC }, { majorCode: '7520114', score: 22, sourceUrl: SRC }] },
  { code: 'SGU', name: 'Đại học Sài Gòn', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://sgu.edu.vn', description: 'Trường đại học công lập TP.HCM.', majors: [{ majorCode: '7140231', score: 22, sourceUrl: SRC }, { majorCode: '7480201', score: 22.5, sourceUrl: SRC }] },
  { code: 'HUFLIT', name: 'Đại học Ngoại ngữ - Tin học TP.HCM', province: 'TP. Hồ Chí Minh', type: 'UNIVERSITY', website: 'https://huflit.edu.vn', description: 'Trường ngoại ngữ tin học.', majors: [{ majorCode: '7220201', score: 21, sourceUrl: SRC }, { majorCode: '7480201', score: 21.5, sourceUrl: SRC }] },
  { code: 'DUY_TAN', name: 'Đại học Duy Tân', province: 'Đà Nẵng', type: 'UNIVERSITY', website: 'https://duytan.edu.vn', description: 'Trường đại học tư thục miền Trung.', majors: [{ majorCode: '7480201', score: 20, sourceUrl: SRC }, { majorCode: '7720101', score: 22, sourceUrl: SRC }] },
  { code: 'UED', name: 'Đại học Sư phạm - Đại học Đà Nẵng', province: 'Đà Nẵng', type: 'UNIVERSITY', website: 'https://ued.udn.vn', description: 'Trường sư phạm Đà Nẵng.', majors: [{ majorCode: '7140209', score: 23, sourceUrl: SRC }, { majorCode: '7140234', score: 22.5, sourceUrl: SRC }] },
  { code: 'QNU', name: 'Đại học Quy Nhơn', province: 'Bình Định', type: 'UNIVERSITY', website: 'https://qnu.edu.vn', description: 'Trường đại học vùng Nam Trung Bộ.', majors: [{ majorCode: '7480201', score: 21, sourceUrl: SRC }, { majorCode: '7140231', score: 20.5, sourceUrl: SRC }] },
  { code: 'TNU', name: 'Đại học Thái Nguyên', province: 'Thái Nguyên', type: 'UNIVERSITY', website: 'https://tnu.edu.vn', description: 'Đại học vùng trung du miền núi.', majors: [{ majorCode: '7720101', score: 24, sourceUrl: SRC }, { majorCode: '7480201', score: 22, sourceUrl: SRC }] },
  { code: 'TNUS', name: 'Đại học Sư phạm Thái Nguyên', province: 'Thái Nguyên', type: 'UNIVERSITY', website: 'https://dhsptn.edu.vn', description: 'Trường sư phạm Thái Nguyên.', majors: [{ majorCode: '7140209', score: 21.5, sourceUrl: SRC }, { majorCode: '7140231', score: 21, sourceUrl: SRC }] },
  { code: 'HPU', name: 'Đại học Hải Phòng', province: 'Hải Phòng', type: 'UNIVERSITY', website: 'https://dhhp.edu.vn', description: 'Trường đại học Hải Phòng.', majors: [{ majorCode: '7480201', score: 21, sourceUrl: SRC }, { majorCode: '7340101', score: 20.5, sourceUrl: SRC }] },
  { code: 'VIMARU', name: 'Đại học Hàng hải Việt Nam', province: 'Hải Phòng', type: 'UNIVERSITY', website: 'https://vimaru.edu.vn', description: 'Trường hàng hải.', majors: [{ majorCode: '7520113', score: 21, sourceUrl: SRC }, { majorCode: '7580201', score: 20.5, sourceUrl: SRC }] },
  { code: 'NAUE', name: 'Đại học Kinh tế Nghệ An', province: 'Nghệ An', type: 'UNIVERSITY', website: 'https://naue.edu.vn', description: 'Trường kinh tế Nghệ An.', majors: [{ majorCode: '7340101', score: 19.5, sourceUrl: SRC }] },
  { code: 'VINH', name: 'Đại học Vinh', province: 'Nghệ An', type: 'UNIVERSITY', website: 'https://vinhuni.edu.vn', description: 'Trường đại học Vinh.', majors: [{ majorCode: '7140209', score: 22, sourceUrl: SRC }, { majorCode: '7480201', score: 21.5, sourceUrl: SRC }] },
  { code: 'TUE', name: 'Đại học Y Dược Huế', province: 'Thừa Thiên Huế', type: 'UNIVERSITY', website: 'https://huemed-univ.edu.vn', description: 'Trường y dược Huế.', majors: [{ majorCode: '7720101', score: 26, sourceUrl: SRC }, { majorCode: '7720201', score: 25, sourceUrl: SRC }] },
  { code: 'DALAT', name: 'Đại học Đà Lạt', province: 'Lâm Đồng', type: 'UNIVERSITY', website: 'https://dlu.edu.vn', description: 'Trường đại học Đà Lạt.', majors: [{ majorCode: '7480201', score: 20, sourceUrl: SRC }, { majorCode: '7220201', score: 19.5, sourceUrl: SRC }] },
  { code: 'NTU', name: 'Đại học Nha Trang', province: 'Khánh Hòa', type: 'UNIVERSITY', website: 'https://ntu.edu.vn', description: 'Trường đại học Nha Trang.', majors: [{ majorCode: '7480201', score: 21, sourceUrl: SRC }, { majorCode: '7340101', score: 20, sourceUrl: SRC }] },
  { code: 'TAY_NGUYEN', name: 'Đại học Tây Nguyên', province: 'Đắk Lắk', type: 'UNIVERSITY', website: 'https://ttn.edu.vn', description: 'Trường đại học Tây Nguyên.', majors: [{ majorCode: '7720301', score: 20, sourceUrl: SRC }, { majorCode: '7140231', score: 19.5, sourceUrl: SRC }] },
  { code: 'AGU', name: 'Đại học An Giang', province: 'An Giang', type: 'UNIVERSITY', website: 'https://agu.edu.vn', description: 'Trường đại học An Giang.', majors: [{ majorCode: '7140234', score: 19, sourceUrl: SRC }, { majorCode: '7480201', score: 19.5, sourceUrl: SRC }] },
];

export function blocksForCatalogMajor(majorCode: string, group?: string): readonly string[] {
  return defaultBlocksForMajor(majorCode, group);
}
