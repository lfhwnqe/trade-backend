import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道配置
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剥离非白名单属性
      forbidNonWhitelisted: true, // 如果存在非白名单属性则抛出错误
      transform: true, // 自动将有效载荷转换为DTO实例
      disableErrorMessages: false, // 启用详细的验证错误消息
      validationError: {
        target: false, // 不在错误对象中包含目标
        value: false, // 不在错误对象中包含值
      },
    }),
  );

  // 注意：全局拦截器和过滤器已在 AppModule 中通过 APP_INTERCEPTOR 和 APP_FILTER 提供者注册
  // 这种方式确保依赖注入正常工作，比在这里使用 useGlobalInterceptors 和 useGlobalFilters 更好

  // 配置Swagger文档
  const config = new DocumentBuilder()
    .setTitle('Trade API')
    .setDescription('Trade应用API文档 - 已集成标准化响应格式')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: '输入JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('用户管理', '用户注册、登录、认证相关接口')
    .addTag('交易管理', '真实交易记录管理相关接口')
    .addTag('图片管理', '交易图片上传和管理相关接口')
    .addTag('RAG系统', '知识库和问答系统相关接口')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Trade API 文档',
    customfavIcon: 'https://docs.nestjs.com/assets/logo-small.svg',
    customCss: `
      .topbar-wrapper .link {
        content: url('https://docs.nestjs.com/assets/logo-small.svg');
        width: 80px;
        height: auto;
      }
      .swagger-ui .topbar {
        background-color: #1976d2;
      }
    `,
    swaggerOptions: {
      persistAuthorization: true, // 保持授权状态
      displayRequestDuration: true, // 显示请求持续时间
      docExpansion: 'none', // 默认折叠所有操作
      filter: true, // 启用过滤器
      showExtensions: true, // 显示扩展
      showCommonExtensions: true, // 显示通用扩展
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
