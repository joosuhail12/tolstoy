import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  validate,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ApiKeyAuthConfigDto } from './api-key-auth-config.dto';
import { OAuthAuthConfigDto } from './oauth-auth-config.dto';

@ValidatorConstraint({ name: 'authConfigValidator', async: true })
export class AuthConfigValidator implements ValidatorConstraintInterface {
  async validate(config: Record<string, unknown>, args: ValidationArguments): Promise<boolean> {
    const object = args.object as { type: string };
    const type = object.type;

    if (!type) {
      return false;
    }

    let dto;
    if (type === 'apiKey') {
      dto = plainToInstance(ApiKeyAuthConfigDto, config);
      const errors = await validate(dto);
      return errors.length === 0;
    } else if (type === 'oauth2') {
      dto = plainToInstance(OAuthAuthConfigDto, config);
      const errors = await validate(dto);
      return errors.length === 0;
    }

    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as { type: string };
    const type = object.type;

    if (type === 'apiKey') {
      return 'config must contain valid API key configuration with headerName and headerValue';
    } else if (type === 'oauth2') {
      return 'config must contain valid OAuth2 configuration with clientId, clientSecret, and accessToken';
    }

    return 'config must be valid for the specified auth type';
  }
}
