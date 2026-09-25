import 'reflect-metadata';
import { join } from 'path';
import { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const codigo = req.path.match(/^\/frame\/(\d+)\/?$/)?.[1];
    if (req.method === 'GET' && codigo) {
      const busca = new URLSearchParams();
      for (const [chave, valor] of Object.entries(req.query)) {
        if (typeof valor === 'string') busca.set(chave, valor);
      }
      busca.set('eleicao', codigo);
      res.redirect(302, `/frame?${busca}`);
      return;
    }
    next();
  });
  app.useStaticAssets(join(__dirname, '..', '..', 'frontend'));
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? true, methods: ['GET', 'POST', 'OPTIONS'] });
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
