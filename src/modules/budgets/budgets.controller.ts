import { BudgetsService } from './budgets.service';

export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}
}
