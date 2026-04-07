import { AccountsService } from './accounts.service';

export class AccountsController {
  constructor(private readonly service: AccountsService) {}
}
