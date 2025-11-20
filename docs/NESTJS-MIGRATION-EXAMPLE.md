# Exemplo Prático: Migração de Edge Function para NestJS

Este documento mostra um exemplo concreto de como migrar uma Edge Function para NestJS.

---

## 📝 Exemplo: `auth-signup`

### Antes: Edge Function (Deno)

**Arquivo**: `supabase/functions/auth-signup/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
  const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
  
  if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Missing env', { status: 500 })
  }

  let body: { email: string; password: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!body.email || !body.password) {
    return new Response('email and password are required', { status: 400 })
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
  const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        name: body.name || '',
      },
    })

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, user: data.user }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
```

---

### Depois: NestJS

#### 1. DTO (Data Transfer Object)

**Arquivo**: `src/modules/auth/dto/signup.dto.ts`

```typescript
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;
}
```

#### 2. Service

**Arquivo**: `src/modules/auth/auth.service.ts`

```typescript
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('MASTER_SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('MASTER_SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async signup(signupDto: SignupDto) {
    try {
      const { data, error } = await this.supabase.auth.admin.createUser({
        email: signupDto.email,
        password: signupDto.password,
        email_confirm: true,
        user_metadata: {
          name: signupDto.name || '',
        },
      });

      if (error) {
        throw new BadRequestException(error.message);
      }

      return {
        ok: true,
        user: data.user,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }
}
```

#### 3. Controller

**Arquivo**: `src/modules/auth/auth.controller.ts`

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiResponse({ status: 200, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or user already exists' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }
}
```

#### 4. Module

**Arquivo**: `src/modules/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

#### 5. App Module

**Arquivo**: `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AuthModule,
  ],
})
export class AppModule {}
```

#### 6. Main.ts

**Arquivo**: `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('TomikCRM API')
    .setDescription('TomikCRM Backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap();
```

---

## 🔄 Comparação: Antes vs Depois

### Vantagens do NestJS

1. **Type Safety**: DTOs com validação automática
2. **Estrutura**: Separação clara de responsabilidades (Controller → Service)
3. **Testabilidade**: Fácil de mockar e testar
4. **Documentação**: Swagger automático
5. **Validação**: Class-validator integrado
6. **Error Handling**: Exception filters centralizados
7. **Dependency Injection**: Facilita testes e manutenção

### Desvantagens

1. **Complexidade**: Mais arquivos para funções simples
2. **Deploy**: Precisa de servidor (não é serverless nativo)
3. **Cold Start**: Pode ser mais lento que Edge Functions

---

## 🧪 Testes

### Unit Test: AuthService

**Arquivo**: `src/modules/auth/auth.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

describe('AuthService', () => {
  let service: AuthService;
  let supabaseMock: any;

  beforeEach(async () => {
    supabaseMock = {
      auth: {
        admin: {
          createUser: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'MASTER_SUPABASE_URL') return 'https://test.supabase.co';
              if (key === 'MASTER_SUPABASE_SERVICE_ROLE_KEY') return 'test-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    // Mock supabase client
    (service as any).supabase = supabaseMock;
  });

  it('should create user successfully', async () => {
    const signupDto: SignupDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    supabaseMock.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: '123', email: signupDto.email } },
      error: null,
    });

    const result = await service.signup(signupDto);

    expect(result.ok).toBe(true);
    expect(result.user.email).toBe(signupDto.email);
  });

  it('should throw BadRequestException on error', async () => {
    const signupDto: SignupDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    supabaseMock.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: 'User already exists' },
    });

    await expect(service.signup(signupDto)).rejects.toThrow(BadRequestException);
  });
});
```

### E2E Test

**Arquivo**: `test/auth.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/signup (POST) - should create user', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
        expect(res.body.user).toBeDefined();
      });
  });

  it('/auth/signup (POST) - should fail with invalid email', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'invalid-email',
        password: 'password123',
      })
      .expect(400);
  });
});
```

---

## 📊 Métricas de Migração

### Linhas de Código

- **Edge Function**: ~60 linhas
- **NestJS**: ~200 linhas (incluindo DTOs, testes, etc.)

**Aumento**: ~3x mais código, mas muito mais estruturado e testável.

### Tempo de Desenvolvimento

- **Edge Function**: 30 minutos (código simples)
- **NestJS**: 2-3 horas (incluindo testes e documentação)

**Aumento**: ~4-6x mais tempo inicial, mas facilita manutenção futura.

---

## 🎯 Próximos Passos

1. Migrar outras funções de auth (`auth-magic-link`, `auth-recovery`)
2. Criar módulo compartilhado para Supabase client
3. Adicionar logging estruturado
4. Implementar rate limiting
5. Adicionar métricas (Prometheus)

---

## 📚 Referências

- [NestJS Documentation](https://docs.nestjs.com/)
- [Class Validator](https://github.com/typestack/class-validator)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)










