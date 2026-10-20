import { GameDataStore } from "./index.js";
const store = new GameDataStore(
  process.env.GAME_DATA_PATH ?? ".data/game-data.sqlite",
);
try {
  console.log(
    JSON.stringify(
      process.argv[2]
        ? store.importSqlite(process.argv[2], process.argv[3] ?? "manual")
        : await store.updateLatest(),
      null,
      2,
    ),
  );
} finally {
  store.close();
}
