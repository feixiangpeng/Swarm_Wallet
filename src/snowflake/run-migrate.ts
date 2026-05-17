import { migrateSnowflakeSchema } from "./migrate"

migrateSnowflakeSchema()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
