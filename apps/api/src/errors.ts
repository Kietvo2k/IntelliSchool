export class AppError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message = 'Yêu cầu không hợp lệ.', code = 'BAD_REQUEST') => new AppError(400, code, message);
export const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Không tìm thấy dữ liệu phù hợp.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const unprocessable = (message: string, code = 'VALIDATION_ERROR') => new AppError(422, code, message);
