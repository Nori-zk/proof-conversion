import { ComputationalPlanExecutor } from "./execute.js";
import { NumaNodeTestComputationPlan } from "./plans/tests/numa.js";

async function main() {
    const testPlanExecutor = new ComputationalPlanExecutor(12);
    const result = await testPlanExecutor.execute(new NumaNodeTestComputationPlan());
    console.log(result);
}

main().catch(console.error);

