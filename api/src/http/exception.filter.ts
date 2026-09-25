import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class ErroFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    if (body && typeof body === 'object' && 'erro' in body) {
      res.status(status).json(body);
      return;
    }
    res.status(status).json({ erro: { codigo: 'ERRO', mensagem: exception.message } });
  }
}
