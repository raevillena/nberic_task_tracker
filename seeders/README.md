# Database Seeders

This directory contains database seeders for populating the database with initial demo data.

## Seeder Files

### `20240101000000-demo-data.js`

Seeds the database with:
- **3 Users**:
  - 1 Manager (manager@nberic.com)
  - 2 Researchers (researcher1@nberic.com, researcher2@nberic.com)
- **2 Projects**:
  - Clinical Trial Phase I
  - Epidemiology Study 2024
- **3 Studies** (distributed across projects)
- **10 Tasks** (with various statuses, priorities, and assignments)

## Usage

### Run All Seeders

```bash
npm run db:seed
```

Or using sequelize-cli directly:

```bash
npx sequelize-cli db:seed:all
```

### Run Specific Seeder

```bash
npx sequelize-cli db:seed --seed 20240101000000-demo-data.js
```

### Undo Seeder

```bash
npx sequelize-cli db:seed:undo
```

Or undo all:

```bash
npx sequelize-cli db:seed:undo:all
```

## Demo Login Credentials

After running the seeder, you can use these credentials to log in:

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@nberic.com | Manager123! |
| Researcher | researcher1@nberic.com | Researcher123! |
| Researcher | researcher2@nberic.com | Researcher456! |

## Notes

- Passwords are hashed using bcrypt with 12 salt rounds
- Progress values start at 0% and will be calculated automatically by the progress service
- Task due dates are set relative to the current date
- Some tasks are completed to demonstrate the progress calculation system

## Development

When creating new seeders:

1. Use timestamp format: `YYYYMMDDHHMMSS-description.js`
2. Use `queryInterface.bulkInsert()` for direct database operations
3. Hash passwords using `bcrypt.hashSync()` (synchronous for seeders)
4. Always implement both `up()` and `down()` methods
5. Use proper foreign key relationships
6. Include console.log statements for progress tracking

