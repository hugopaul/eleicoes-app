import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';

export function erro(codigo: string, mensagem: string, status: 400 | 404): never {
  const body = { erro: { codigo, mensagem } };
  if (status === 400) throw new BadRequestException(body);
  throw new NotFoundException(body);
}

export function enviar(res: Response, body: unknown, etag: string | null) {
  const pedido = res.req.headers['if-none-match'];
  if (etag && pedido === etag) {
    res.status(304).end();
    return;
  }
  if (etag) res.setHeader('ETag', etag);
  res.json(body);
}
