import { Migration } from '@mikro-orm/migrations';

export class Migration20240328071020 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `account` modify `state` enum(\'NORMAL\', \'FROZEN\', \'BLOCKED_BY_ADMIN\') not null default \'NORMAL\' comment \'NORMAL, FROZEN, BLOCKED_BY_ADMIN\';');
  }

  async down(): Promise<void> {
    this.addSql('alter table `account` modify `state` enum(\'FROZEN\', \'BLOCKED_BY_ADMIN\', \'NORMAL\') not null comment \'FROZEN, BLOCKED_BY_ADMIN, NORMAL\';');
  }

}
