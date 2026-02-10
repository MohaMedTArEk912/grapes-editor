//! Backend Code Generator
//! 
//! Generates a production-ready NestJS + Prisma backend from API schemas,
//! data models, and logic flows. Output includes:
//!   - Prisma service with typed client
//!   - CRUD services per data model
//!   - Controllers wired to services
//!   - Auth module (JWT + bcrypt)
//!   - app.module.ts with all providers
//!   - Validation DTOs
//!   - main.ts with Swagger, CORS, global pipes
//!   - package.json, tsconfig, nest-cli, .env, Dockerfile, docker-compose

use crate::schema::{ProjectSchema, ApiSchema, HttpMethod, DataModelSchema};
use crate::schema::data_model::FieldType;
use std::collections::HashMap;

// ─── public API ──────────────────────────────────────────

pub struct BackendGenerator<'a> {
    project: &'a ProjectSchema,
}

impl<'a> BackendGenerator<'a> {
    pub fn new(project: &'a ProjectSchema) -> Self {
        Self { project }
    }

    pub fn generate(&self) -> GeneratedBackend {
        let mut files: Vec<GeneratedFile> = Vec::new();

        // ── Prisma service (singleton) ──
        files.push(gf("src/prisma/prisma.service.ts", self.gen_prisma_service()));
        files.push(gf("src/prisma/prisma.module.ts", self.gen_prisma_module()));

        // ── Auth module ──
        files.push(gf("src/auth/auth.module.ts", self.gen_auth_module()));
        files.push(gf("src/auth/auth.service.ts", self.gen_auth_service()));
        files.push(gf("src/auth/auth.controller.ts", self.gen_auth_controller()));
        files.push(gf("src/auth/jwt.strategy.ts", self.gen_jwt_strategy()));
        files.push(gf("src/auth/jwt-auth.guard.ts", self.gen_jwt_guard()));
        files.push(gf("src/auth/roles.guard.ts", self.gen_roles_guard()));
        files.push(gf("src/auth/roles.decorator.ts", Self::gen_roles_decorator()));
        files.push(gf("src/auth/dto/register.dto.ts", self.gen_register_dto()));
        files.push(gf("src/auth/dto/login.dto.ts", self.gen_login_dto()));

        // ── Per-model service + controller + DTOs ──
        let models: Vec<&DataModelSchema> = self.project.data_models.iter().filter(|m| !m.archived).collect();
        for model in &models {
            let lower = model.name.to_lowercase();
            files.push(gf(&format!("src/{0}/{0}.service.ts", lower), self.gen_model_service(model)));
            files.push(gf(&format!("src/{0}/{0}.module.ts", lower), self.gen_model_module(model)));
            files.push(gf(&format!("src/{0}/dto/create-{0}.dto.ts", lower), self.gen_create_dto(model)));
            files.push(gf(&format!("src/{0}/dto/update-{0}.dto.ts", lower), self.gen_update_dto(model)));
        }

        // ── Controllers (grouped by API resource) ──
        let mut ctrl_map: HashMap<String, Vec<&ApiSchema>> = HashMap::new();
        for api in &self.project.apis {
            if !api.archived {
                let resource = extract_resource(&api.path);
                ctrl_map.entry(resource).or_default().push(api);
            }
        }
        for (resource, apis) in &ctrl_map {
            files.push(gf(
                &format!("src/{0}/{0}.controller.ts", resource),
                self.gen_controller(resource, apis, &models),
            ));
        }

        // ── App module (wires everything) ──
        files.push(gf("src/app.module.ts", self.gen_app_module(&models, &ctrl_map)));

        // ── main.ts ──
        files.push(gf("src/main.ts", self.gen_main()));

        // ── Config files ──
        files.push(gf("package.json", self.gen_package_json()));
        files.push(gf("tsconfig.json", Self::gen_tsconfig()));
        files.push(gf("tsconfig.build.json", Self::gen_tsconfig_build()));
        files.push(gf("nest-cli.json", Self::gen_nest_cli()));
        files.push(gf(".env", self.gen_dotenv()));
        files.push(gf(".env.example", self.gen_dotenv()));
        files.push(gf("Dockerfile", Self::gen_dockerfile()));
        files.push(gf("docker-compose.yml", self.gen_docker_compose()));
        files.push(gf(".dockerignore", Self::gen_dockerignore()));
        files.push(gf("README.md", self.gen_readme()));

        // ── Prisma seed ──
        files.push(gf("prisma/seed.ts", self.gen_seed()));

        // ── Tests ──
        for model in &models {
            let lower = model.name.to_lowercase();
            files.push(gf(
                &format!("test/{}.e2e-spec.ts", lower),
                self.gen_model_test(model),
            ));
        }
        files.push(gf("test/auth.e2e-spec.ts", Self::gen_auth_test()));
        files.push(gf("test/jest-e2e.json", Self::gen_jest_config()));

        GeneratedBackend { files }
    }
}

// ─── Prisma service / module ─────────────────────────────

impl<'a> BackendGenerator<'a> {
    fn gen_prisma_service(&self) -> String {
        r#"import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
"#.into()
    }

    fn gen_prisma_module(&self) -> String {
        r#"import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
"#.into()
    }
}

// ─── Auth module ─────────────────────────────────────────

impl<'a> BackendGenerator<'a> {
    fn gen_auth_module(&self) -> String {
        r#"import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me-in-production',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
"#.into()
    }

    fn gen_auth_service(&self) -> String {
        r#"import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email already registered');

    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, password: hash, name: name ?? email.split('@')[0] },
    });

    const { password: _, ...result } = user;
    return { user: result, token: this.signToken(user.id, user.email) };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { password: _, ...result } = user;
    return { user: result, token: this.signToken(user.id, user.email) };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { password: _, ...result } = user;
    return result;
  }

  private signToken(userId: string, email: string) {
    return this.jwt.sign({ sub: userId, email });
  }
}
"#.into()
    }

    fn gen_auth_controller(&self) -> String {
        r#"import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return this.auth.getProfile(req.user.sub);
  }
}
"#.into()
    }

    fn gen_jwt_strategy(&self) -> String {
        r#"import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change-me-in-production',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    return { sub: payload.sub, email: payload.email };
  }
}
"#.into()
    }

    fn gen_jwt_guard(&self) -> String {
        r#"import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
"#.into()
    }

    fn gen_roles_guard(&self) -> String {
        r#"import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user?.role === role || user?.roles?.includes(role));
  }
}
"#.into()
    }

    fn gen_roles_decorator() -> String {
        r#"import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
"#.into()
    }

    fn gen_register_dto(&self) -> String {
        r#"import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
"#.into()
    }

    fn gen_login_dto(&self) -> String {
        r#"import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
"#.into()
    }
}

// ─── Per-model service + module + DTOs ───────────────────

impl<'a> BackendGenerator<'a> {
    fn gen_model_service(&self, model: &DataModelSchema) -> String {
        let pascal = to_pascal_case(&model.name);
        let lower = model.name.to_lowercase();
        let camel = to_camel_case_single(&model.name);

        // Build select object (exclude password-like fields from default select)
        let _fields: Vec<&crate::schema::data_model::FieldSchema> =
            model.fields.iter().filter(|f| f.name != "id").collect();

        let soft_delete_filter = if model.soft_delete {
            format!("\n    private baseWhere = {{ deletedAt: null }};\n")
        } else {
            String::new()
        };
        let where_clause = if model.soft_delete { "...this.baseWhere, " } else { "" };
        let soft_delete_method = if model.soft_delete {
            format!(r#"
  async softDelete(id: string) {{
    return this.prisma.{camel}.update({{
      where: {{ id }},
      data: {{ deletedAt: new Date() }},
    }});
  }}
"#, camel = camel)
        } else {
            String::new()
        };

        format!(r#"import {{ Injectable, NotFoundException }} from '@nestjs/common';
import {{ PrismaService }} from '../prisma/prisma.service';
import {{ Create{pascal}Dto }} from './dto/create-{lower}.dto';
import {{ Update{pascal}Dto }} from './dto/update-{lower}.dto';

@Injectable()
export class {pascal}Service {{
  constructor(private prisma: PrismaService) {{}}{soft_delete}

  async create(dto: Create{pascal}Dto) {{
    return this.prisma.{camel}.create({{ data: dto }});
  }}

  async findAll(page = 1, limit = 20) {{
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.{camel}.findMany({{ where: {{ {where_clause} }}, skip, take: limit, orderBy: {{ createdAt: 'desc' }} }}),
      this.prisma.{camel}.count({{ where: {{ {where_clause} }} }}),
    ]);
    return {{ data, total, page, limit, totalPages: Math.ceil(total / limit) }};
  }}

  async findOne(id: string) {{
    const record = await this.prisma.{camel}.findUnique({{ where: {{ id }} }});
    if (!record) throw new NotFoundException('{pascal} not found');
    return record;
  }}

  async update(id: string, dto: Update{pascal}Dto) {{
    await this.findOne(id);
    return this.prisma.{camel}.update({{ where: {{ id }}, data: dto }});
  }}

  async remove(id: string) {{
    await this.findOne(id);
    return this.prisma.{camel}.delete({{ where: {{ id }} }});
  }}{soft_delete_method}
}}
"#,
            pascal = pascal,
            lower = lower,
            camel = camel,
            soft_delete = soft_delete_filter,
            where_clause = where_clause,
            soft_delete_method = soft_delete_method,
        )
    }

    fn gen_model_module(&self, model: &DataModelSchema) -> String {
        let pascal = to_pascal_case(&model.name);
        let lower = model.name.to_lowercase();
        format!(r#"import {{ Module }} from '@nestjs/common';
import {{ {pascal}Service }} from './{lower}.service';
import {{ {pascal}Controller }} from './{lower}.controller';

@Module({{
  controllers: [{pascal}Controller],
  providers: [{pascal}Service],
  exports: [{pascal}Service],
}})
export class {pascal}Module {{}}
"#, pascal = pascal, lower = lower)
    }

    fn gen_create_dto(&self, model: &DataModelSchema) -> String {
        let pascal = to_pascal_case(&model.name);
        let mut dto_fields = String::new();
        let mut imports: Vec<&str> = vec![];

        for field in &model.fields {
            // Skip auto-generated fields
            if field.primary_key || field.name == "id" { continue; }
            if field.name == "createdAt" || field.name == "updatedAt" || field.name == "deletedAt" { continue; }
            if field.name == "password" {
                // password is a special case — keep it
            }

            let ts_type = field_type_to_ts(&field.field_type);
            let decorators = field_type_to_decorators(&field.field_type, field.required, &field.name, &mut imports);

            dto_fields.push_str(&format!("{decorators}  {name}{opt}: {ts_type};\n\n",
                decorators = decorators,
                name = field.name,
                opt = if field.required { "" } else { "?" },
                ts_type = ts_type,
            ));
        }

        // Deduplicate imports
        imports.sort();
        imports.dedup();
        let import_line = if imports.is_empty() {
            String::new()
        } else {
            format!("import {{ {} }} from 'class-validator';\n\n", imports.join(", "))
        };

        format!("{import_line}export class Create{pascal}Dto {{\n{fields}}}\n",
            import_line = import_line,
            pascal = pascal,
            fields = dto_fields,
        )
    }

    fn gen_update_dto(&self, model: &DataModelSchema) -> String {
        let pascal = to_pascal_case(&model.name);
        let lower = model.name.to_lowercase();
        format!(r#"import {{ PartialType }} from '@nestjs/mapped-types';
import {{ Create{pascal}Dto }} from './create-{lower}.dto';

export class Update{pascal}Dto extends PartialType(Create{pascal}Dto) {{}}
"#, pascal = pascal, lower = lower)
    }
}

// ─── Controllers ─────────────────────────────────────────

impl<'a> BackendGenerator<'a> {
    fn gen_controller(&self, resource: &str, apis: &[&ApiSchema], models: &[&DataModelSchema]) -> String {
        let pascal = to_pascal_case(resource);

        // Find matching model for this resource (by name similarity)
        let model = models.iter().find(|m| m.name.to_lowercase() == *resource || pluralize(&m.name.to_lowercase()) == *resource);

        let mut method_strs = String::new();
        let mut needs_body = false;
        let mut needs_param = false;
        let mut needs_query = false;
        let mut needs_guard = false;

        for api in apis {
            let decorator = http_decorator(&api.method);
            let path_suffix = api.path.strip_prefix(&format!("/{}", resource)).unwrap_or(&api.path);
            let path_suffix = if path_suffix.is_empty() { "/" } else { path_suffix };

            // Map :id params to NestJS style
            let nest_path = path_suffix.replace(":id", ":id");
            let has_id = nest_path.contains(":id");

            let fn_name = to_camel_case(&api.name);

            // Protected endpoint?
            let guard_str = if !api.permissions.is_empty() {
                needs_guard = true;
                let perms: Vec<&str> = api.permissions.iter().map(|s| s.as_str()).collect();
                let has_specific_roles = perms.iter().any(|p| *p != "authenticated");
                if has_specific_roles {
                    let roles_str: Vec<String> = perms.iter()
                        .filter(|p| **p != "authenticated")
                        .map(|p| format!("'{}'", p))
                        .collect();
                    format!("  @UseGuards(JwtAuthGuard, RolesGuard)\n  @Roles({})\n", roles_str.join(", "))
                } else {
                    "  @UseGuards(JwtAuthGuard)\n".to_string()
                }
            } else {
                String::new()
            };

            if has_id { needs_param = true; }

            // Build method signature + body based on HTTP method and model
            let body = match (&api.method, model) {
                (HttpMethod::Get, Some(m)) if !has_id => {
                    needs_query = true;
                    let lower = m.name.to_lowercase();
                    format!(
                        "  @Get('{path}')\n  async {fn_name}(@Query('page') page?: string, @Query('limit') limit?: string) {{\n    return this.{lower}Service.findAll(+(page ?? 1), +(limit ?? 20));\n  }}\n",
                        path = nest_path, fn_name = fn_name, lower = lower,
                    )
                }
                (HttpMethod::Get, Some(m)) if has_id => {
                    let lower = m.name.to_lowercase();
                    format!(
                        "  @Get('{path}')\n  async {fn_name}(@Param('id') id: string) {{\n    return this.{lower}Service.findOne(id);\n  }}\n",
                        path = nest_path, fn_name = fn_name, lower = lower,
                    )
                }
                (HttpMethod::Post, Some(m)) => {
                    needs_body = true;
                    let p = to_pascal_case(&m.name);
                    let lower = m.name.to_lowercase();
                    format!(
                        "  @Post('{path}')\n  async {fn_name}(@Body() dto: Create{p}Dto) {{\n    return this.{lower}Service.create(dto);\n  }}\n",
                        path = nest_path, fn_name = fn_name, p = p, lower = lower,
                    )
                }
                (HttpMethod::Put | HttpMethod::Patch, Some(m)) if has_id => {
                    needs_body = true;
                    let p = to_pascal_case(&m.name);
                    let lower = m.name.to_lowercase();
                    let dec = if api.method == HttpMethod::Put { "Put" } else { "Patch" };
                    format!(
                        "  @{dec}('{path}')\n  async {fn_name}(@Param('id') id: string, @Body() dto: Update{p}Dto) {{\n    return this.{lower}Service.update(id, dto);\n  }}\n",
                        dec = dec, path = nest_path, fn_name = fn_name, p = p, lower = lower,
                    )
                }
                (HttpMethod::Delete, Some(m)) if has_id => {
                    let lower = m.name.to_lowercase();
                    format!(
                        "  @Delete('{path}')\n  async {fn_name}(@Param('id') id: string) {{\n    return this.{lower}Service.remove(id);\n  }}\n",
                        path = nest_path, fn_name = fn_name, lower = lower,
                    )
                }
                // Fallback for APIs without a matching model
                _ => {
                    format!(
                        "  @{dec}('{path}')\n  async {fn_name}() {{\n    return {{ message: '{name}' }};\n  }}\n",
                        dec = decorator, path = nest_path, fn_name = fn_name, name = api.name,
                    )
                }
            };

            method_strs.push_str(&guard_str);
            method_strs.push_str(&body);
            method_strs.push('\n');
        }

        // Build imports
        let mut import_decorators = vec!["Controller"];
        for api in apis {
            let d = http_decorator(&api.method);
            if !import_decorators.contains(&d) {
                import_decorators.push(d);
            }
        }
        if needs_body { import_decorators.push("Body"); }
        if needs_param { import_decorators.push("Param"); }
        if needs_query { import_decorators.push("Query"); }
        if needs_guard { import_decorators.push("UseGuards"); }

        let mut extra_imports = String::new();
        if needs_guard {
            extra_imports.push_str("import { JwtAuthGuard } from '../auth/jwt-auth.guard';\n");
            // Check if any endpoint uses specific role permissions
            let has_roles = apis.iter().any(|a| {
                a.permissions.iter().any(|p| p != "authenticated")
            });
            if has_roles {
                extra_imports.push_str("import { RolesGuard } from '../auth/roles.guard';\n");
                extra_imports.push_str("import { Roles } from '../auth/roles.decorator';\n");
            }
        }

        if let Some(m) = model {
            let p = to_pascal_case(&m.name);
            let lower = m.name.to_lowercase();
            extra_imports.push_str(&format!("import {{ {}Service }} from './{}.service';\n", p, lower));
            if needs_body {
                extra_imports.push_str(&format!("import {{ Create{}Dto }} from './dto/create-{}.dto';\n", p, lower));
                extra_imports.push_str(&format!("import {{ Update{}Dto }} from './dto/update-{}.dto';\n", p, lower));
            }
        }

        let constructor = if let Some(m) = model {
            let lower = m.name.to_lowercase();
            let p = to_pascal_case(&m.name);
            format!("  constructor(private {}Service: {}Service) {{}}\n\n", lower, p)
        } else {
            String::new()
        };

        format!(r#"import {{ {decorators} }} from '@nestjs/common';
{extra_imports}
@Controller('{resource}')
export class {pascal}Controller {{
{constructor}{methods}}}
"#,
            decorators = import_decorators.join(", "),
            extra_imports = extra_imports,
            resource = resource,
            pascal = pascal,
            constructor = constructor,
            methods = method_strs,
        )
    }
}

// ─── App module ──────────────────────────────────────────

impl<'a> BackendGenerator<'a> {
    fn gen_app_module(&self, models: &[&DataModelSchema], ctrl_map: &HashMap<String, Vec<&ApiSchema>>) -> String {
        let mut imports_code = String::from("import { Module } from '@nestjs/common';\nimport { PrismaModule } from './prisma/prisma.module';\nimport { AuthModule } from './auth/auth.module';\n");
        let mut module_list = vec!["PrismaModule".to_string(), "AuthModule".to_string()];

        for m in models {
            let pascal = to_pascal_case(&m.name);
            let lower = m.name.to_lowercase();
            imports_code.push_str(&format!("import {{ {}Module }} from './{}/{}.module';\n", pascal, lower, lower));
            module_list.push(format!("{}Module", pascal));
        }

        // If a controller resource doesn't match any model, import it standalone
        for resource in ctrl_map.keys() {
            let has_model = models.iter().any(|m| m.name.to_lowercase() == *resource || pluralize(&m.name.to_lowercase()) == *resource);
            if !has_model {
                let pascal = to_pascal_case(resource);
                imports_code.push_str(&format!("import {{ {}Controller }} from './{}/{}.controller';\n", pascal, resource, resource));
            }
        }

        let standalone_controllers: Vec<String> = ctrl_map.keys()
            .filter(|r| !models.iter().any(|m| m.name.to_lowercase() == **r || pluralize(&m.name.to_lowercase()) == **r))
            .map(|r| format!("{}Controller", to_pascal_case(r)))
            .collect();

        let controllers_str = if standalone_controllers.is_empty() {
            String::new()
        } else {
            format!("\n  controllers: [{}],", standalone_controllers.join(", "))
        };

        format!(r#"{imports_code}
@Module({{
  imports: [{modules}],{controllers_str}
}})
export class AppModule {{}}
"#,
            imports_code = imports_code,
            modules = module_list.join(", "),
            controllers_str = controllers_str,
        )
    }
}

// ─── main.ts ─────────────────────────────────────────────

impl<'a> BackendGenerator<'a> {
    fn gen_main(&self) -> String {
        r#"import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('API')
    .setDescription('Auto-generated API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
"#.into()
    }
}

// ─── Config files ────────────────────────────────────────

impl<'a> BackendGenerator<'a> {
    fn gen_package_json(&self) -> String {
        let name = self.project.name.to_lowercase().replace(' ', "-");
        format!(r#"{{
  "name": "{name}-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {{
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "ts-node prisma/seed.ts"
  }},
  "dependencies": {{
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/mapped-types": "^2.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@prisma/client": "^5.0.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1"
  }},
  "devDependencies": {{
    "@nestjs/cli": "^10.0.0",
    "@types/bcrypt": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/passport-jwt": "^4.0.0",
    "prisma": "^5.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.3.0"
  }}
}}
"#, name = name)
    }

    fn gen_tsconfig() -> String {
        r#"{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
"#.into()
    }

    fn gen_tsconfig_build() -> String {
        r#"{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
"#.into()
    }

    fn gen_nest_cli() -> String {
        r#"{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
"#.into()
    }

    fn gen_dotenv(&self) -> String {
        format!(r#"# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/{db}?schema=public"

# Auth
JWT_SECRET="change-this-to-a-random-secret"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
CORS_ORIGIN="http://localhost:5173"
"#, db = self.project.name.to_lowercase().replace(' ', "_"))
    }

    fn gen_dockerfile() -> String {
        r#"# ---- Build ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Production ----
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
"#.into()
    }

    fn gen_docker_compose(&self) -> String {
        let db_name = self.project.name.to_lowercase().replace(' ', "_");
        format!(r#"version: '3.8'

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: {db}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: .
    restart: unless-stopped
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/{db}?schema=public
      JWT_SECRET: ${{JWT_SECRET:-change-this-to-a-random-secret}}
      PORT: 3000
    ports:
      - '3000:3000'

volumes:
  pgdata:
"#, db = db_name)
    }

    fn gen_dockerignore() -> String {
        r#"node_modules
dist
.env
.git
"#.into()
    }

    fn gen_readme(&self) -> String {
        format!(r#"# {} — Backend

Auto-generated NestJS + Prisma backend.

## Quick Start

```bash
# Install dependencies
npm install

# Start PostgreSQL (Docker)
docker compose up -d db

# Run migrations
npx prisma migrate dev --name init

# Start dev server
npm run start:dev
```

Server runs on `http://localhost:3000`.  
Swagger docs at `http://localhost:3000/docs`.

## Auth Endpoints

| Method | Path               | Description      |
|--------|--------------------|------------------|
| POST   | /api/auth/register | Register a user  |
| POST   | /api/auth/login    | Login, get JWT   |
| GET    | /api/auth/profile  | Get current user |

## Environment Variables

See `.env.example` for all required variables.
"#, self.project.name)
    }
}

// ─── helpers ─────────────────────────────────────────────

fn gf(path: &str, content: String) -> GeneratedFile {
    GeneratedFile { path: path.to_string(), content }
}

fn extract_resource(path: &str) -> String {
    // /api/users/:id → users, /users → users
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty() && *s != "api").collect();
    segments.first().unwrap_or(&"resource").to_string()
}

fn http_decorator(m: &HttpMethod) -> &'static str {
    match m {
        HttpMethod::Get => "Get",
        HttpMethod::Post => "Post",
        HttpMethod::Put => "Put",
        HttpMethod::Patch => "Patch",
        HttpMethod::Delete => "Delete",
    }
}

fn field_type_to_ts(ft: &FieldType) -> &'static str {
    match ft {
        FieldType::String | FieldType::Text | FieldType::Email | FieldType::Url | FieldType::Uuid => "string",
        FieldType::Int => "number",
        FieldType::Float => "number",
        FieldType::Boolean => "boolean",
        FieldType::DateTime => "string",
        FieldType::Json => "any",
        FieldType::Bytes => "Buffer",
    }
}

fn field_type_to_decorators<'b>(ft: &FieldType, required: bool, name: &str, imports: &mut Vec<&'b str>) -> String {
    let mut decs = Vec::new();

    if !required {
        decs.push("  @IsOptional()".to_string());
        imports.push("IsOptional");
    }

    match ft {
        FieldType::String | FieldType::Text | FieldType::Uuid => {
            decs.push("  @IsString()".to_string());
            imports.push("IsString");
        }
        FieldType::Email => {
            decs.push("  @IsEmail()".to_string());
            imports.push("IsEmail");
        }
        FieldType::Url => {
            decs.push("  @IsUrl()".to_string());
            imports.push("IsUrl");
        }
        FieldType::Int => {
            decs.push("  @IsInt()".to_string());
            imports.push("IsInt");
        }
        FieldType::Float => {
            decs.push("  @IsNumber()".to_string());
            imports.push("IsNumber");
        }
        FieldType::Boolean => {
            decs.push("  @IsBoolean()".to_string());
            imports.push("IsBoolean");
        }
        FieldType::DateTime => {
            decs.push("  @IsDateString()".to_string());
            imports.push("IsDateString");
        }
        _ => {}
    }

    // passwords need min length
    if name == "password" {
        decs.push("  @MinLength(6)".to_string());
        imports.push("MinLength");
    }

    if decs.is_empty() {
        String::new()
    } else {
        format!("{}\n", decs.join("\n"))
    }
}

/// Convert "users" to "Users"
fn to_pascal_case(s: &str) -> String {
    s.split(|c: char| c == '_' || c == '-' || c == ' ')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().chain(chars).collect(),
            }
        })
        .collect()
}

/// Convert PascalCase/snake_case to camelCase (single word like "User" → "user")
fn to_camel_case_single(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_lowercase().chain(chars).collect(),
    }
}

/// Convert a name like "Get Users" to "getUsers"
fn to_camel_case(s: &str) -> String {
    let words: Vec<&str> = s.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    let mut result = String::new();
    for (i, word) in words.iter().enumerate() {
        if i == 0 {
            result.push_str(&word.to_lowercase());
        } else {
            let mut chars = word.chars();
            if let Some(first) = chars.next() {
                result.push(first.to_ascii_uppercase());
                result.extend(chars.map(|c| c.to_ascii_lowercase()));
            }
        }
    }
    result
}

/// Naive plural: "user" → "users" (good enough for resource mapping)
fn pluralize(s: &str) -> String {
    if s.ends_with('s') {
        s.to_string()
    } else if s.ends_with('y') {
        format!("{}ies", &s[..s.len()-1])
    } else {
        format!("{}s", s)
    }
}

// ─── Seed, Tests ─────────────────────────────────────────

impl<'a> BackendGenerator<'a> {
    fn gen_seed(&self) -> String {
        let models: Vec<&DataModelSchema> = self.project.data_models.iter().filter(|m| !m.archived).collect();
        let mut seed_blocks = String::new();

        // Always seed an admin user
        seed_blocks.push_str(r#"
  // Seed admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin',
      role: 'admin',
    },
  });
  console.log('  ✓ Admin user seeded');
"#);

        for model in &models {
            let pascal = to_pascal_case(&model.name);
            let lower = model.name.to_lowercase();

            // Build a sample record from fields
            let mut sample_fields = Vec::new();
            for field in &model.fields {
                if field.primary_key { continue; }
                let val = match field.field_type {
                    FieldType::String | FieldType::Text => format!("'Sample {}'", field.name),
                    FieldType::Email => "'seed@example.com'".into(),
                    FieldType::Url => "'https://example.com'".into(),
                    FieldType::Int => "1".into(),
                    FieldType::Float => "1.5".into(),
                    FieldType::Boolean => "true".into(),
                    FieldType::DateTime => "new Date()".into(),
                    FieldType::Json => "{}".into(),
                    FieldType::Uuid => "undefined".into(),
                    FieldType::Bytes => "Buffer.from('test')".into(),
                };
                if val != "undefined" {
                    sample_fields.push(format!("      {}: {}", field.name, val));
                }
            }

            if !sample_fields.is_empty() {
                seed_blocks.push_str(&format!(r#"
  // Seed {pascal}
  await prisma.{lower}.create({{
    data: {{
{fields}
    }},
  }});
  console.log('  ✓ {pascal} seeded');
"#,
                    pascal = pascal,
                    lower = lower,
                    fields = sample_fields.join(",\n"),
                ));
            }
        }

        format!(r#"import {{ PrismaClient }} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {{
  console.log('🌱 Seeding database...');
{seed_blocks}
  console.log('✅ Seed complete');
}}

main()
  .catch((e) => {{
    console.error(e);
    process.exit(1);
  }})
  .finally(async () => {{
    await prisma.$disconnect();
  }});
"#,
            seed_blocks = seed_blocks,
        )
    }

    fn gen_model_test(&self, model: &DataModelSchema) -> String {
        let pascal = to_pascal_case(&model.name);
        let lower = model.name.to_lowercase();
        let plural = pluralize(&lower);

        // Build sample create DTO fields
        let mut dto_fields = Vec::new();
        for field in &model.fields {
            if field.primary_key { continue; }
            let val = match field.field_type {
                FieldType::String | FieldType::Text => format!("'Test {}'", field.name),
                FieldType::Email => "'test@example.com'".into(),
                FieldType::Url => "'https://test.com'".into(),
                FieldType::Int => "42".into(),
                FieldType::Float => "3.14".into(),
                FieldType::Boolean => "true".into(),
                _ => continue,
            };
            dto_fields.push(format!("      {}: {}", field.name, val));
        }
        let dto_body = dto_fields.join(",\n");

        format!(r#"import {{ Test, TestingModule }} from '@nestjs/testing';
import {{ INestApplication, ValidationPipe }} from '@nestjs/common';
import * as request from 'supertest';
import {{ AppModule }} from '../src/app.module';

describe('{pascal}Controller (e2e)', () => {{
  let app: INestApplication;
  let createdId: string;

  beforeAll(async () => {{
    const moduleFixture: TestingModule = await Test.createTestingModule({{
      imports: [AppModule],
    }}).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({{ whitelist: true, transform: true }}));
    await app.init();
  }});

  afterAll(async () => {{
    await app.close();
  }});

  it('POST /{plural} — create', () => {{
    return request(app.getHttpServer())
      .post('/{plural}')
      .send({{
{dto_body}
      }})
      .expect(201)
      .then((res) => {{
        expect(res.body).toHaveProperty('id');
        createdId = res.body.id;
      }});
  }});

  it('GET /{plural} — findAll', () => {{
    return request(app.getHttpServer())
      .get('/{plural}')
      .expect(200)
      .then((res) => {{
        expect(Array.isArray(res.body.data)).toBe(true);
      }});
  }});

  it('GET /{plural}/:id — findOne', () => {{
    return request(app.getHttpServer())
      .get(`/{plural}/${{createdId}}`)
      .expect(200)
      .then((res) => {{
        expect(res.body.id).toBe(createdId);
      }});
  }});

  it('PUT /{plural}/:id — update', () => {{
    return request(app.getHttpServer())
      .put(`/{plural}/${{createdId}}`)
      .send({{
{dto_body}
      }})
      .expect(200);
  }});

  it('DELETE /{plural}/:id — remove', () => {{
    return request(app.getHttpServer())
      .delete(`/{plural}/${{createdId}}`)
      .expect(200);
  }});
}});
"#,
            pascal = pascal,
            plural = plural,
            dto_body = dto_body,
        )
    }

    fn gen_auth_test() -> String {
        r#"import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register — register new user', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@e2e.com', password: 'testpass123' })
      .expect(201)
      .then((res) => {
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        authToken = res.body.token;
      });
  });

  it('POST /auth/login — login', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@e2e.com', password: 'testpass123' })
      .expect(201)
      .then((res) => {
        expect(res.body).toHaveProperty('token');
        authToken = res.body.token;
      });
  });

  it('GET /auth/profile — get profile (authenticated)', () => {
    return request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty('email');
        expect(res.body.email).toBe('test@e2e.com');
      });
  });

  it('GET /auth/profile — reject without token', () => {
    return request(app.getHttpServer())
      .get('/auth/profile')
      .expect(401);
  });
});
"#.into()
    }

    fn gen_jest_config() -> String {
        r#"{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
"#.into()
    }
}

// ─── Output types ────────────────────────────────────────

pub struct GeneratedBackend {
    pub files: Vec<GeneratedFile>,
}

pub struct GeneratedFile {
    pub path: String,
    pub content: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_pascal_case() {
        assert_eq!(to_pascal_case("users"), "Users");
        assert_eq!(to_pascal_case("user_profiles"), "UserProfiles");
    }

    #[test]
    fn test_to_camel_case() {
        assert_eq!(to_camel_case("Get Users"), "getUsers");
        assert_eq!(to_camel_case("Create User"), "createUser");
    }

    #[test]
    fn test_generate_backend() {
        let mut project = ProjectSchema::new("proj-1", "My App");
        project.add_api(ApiSchema::new("api-1", HttpMethod::Get, "/users", "Get Users"));
        project.add_api(ApiSchema::new("api-2", HttpMethod::Post, "/users", "Create User"));

        let generator = BackendGenerator::new(&project);
        let output = generator.generate();

        // Should have controller, service, module, DTOs, auth, prisma, deployable config
        assert!(output.files.iter().any(|f| f.path.contains("users.controller.ts")));
        assert!(output.files.iter().any(|f| f.path.contains("user.service.ts")));
        assert!(output.files.iter().any(|f| f.path.contains("prisma.service.ts")));
        assert!(output.files.iter().any(|f| f.path.contains("auth.service.ts")));
        assert!(output.files.iter().any(|f| f.path == "Dockerfile"));
        assert!(output.files.iter().any(|f| f.path == "docker-compose.yml"));
        assert!(output.files.iter().any(|f| f.path == ".env"));
    }
}
