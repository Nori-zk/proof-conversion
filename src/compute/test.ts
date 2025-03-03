import { ComputationalPlanExecutor } from "./execute.js";

async function main() {
    const testPlanExecutor = new ComputationalPlanExecutor(12);
    const result = await testPlanExecutor.execute();
    console.log(result);
}

main().catch(console.error);

