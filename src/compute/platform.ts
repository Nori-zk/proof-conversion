import { ComputationalStage, ComputationPlan, Implements, MainThreadComputationStage, SerialComputationalStage } from './plan.js';
import * as os from 'os';

export interface PlatformFeatures {
    platformName: 'linux' | 'windows' | 'darwin';
    numactl?: boolean;
    numaNodes?: number;
}

@Implements<ComputationPlan<PlatformFeatures>>()
export class PlatformFeatureDetectionComputationalPlan implements ComputationPlan<PlatformFeatures> {
    sharedState: PlatformFeatures = {} as PlatformFeatures;
    name = 'PlatformFeatureDetection';
    stages: ComputationalStage<any>[] = [
        {
            type: 'main-thread',
            name: "PlatformDetection",
            execute: (sharedState) => {
                sharedState.platformName = os.platform() as 'linux' | 'windows' | 'darwin';
            },
        } as MainThreadComputationStage<PlatformFeatures>,
        {
            type: 'serial-cmd',
            name: 'NumaCtlCheck',
            prerequisite: (sharedState) => sharedState.platformName === 'linux',
            processCmd: {
                cmd: 'numactl',
                args: ['echo'],
                emit: false,
                capture: true
            },
            callback: (sharedState, result) => {
                if (result.error || result.stdErr) sharedState.numactl = false;
                else sharedState.numactl = true;
            }
        } as SerialComputationalStage<PlatformFeatures>,
        {
            type: 'serial-cmd',
            name: 'NumaCtlNodeCheck',
            prerequisite: (sharedState) => sharedState.numactl == true,
            processCmd: {
                cmd: '/bin/bash',
                args: ['-c', 'numactl --hardware | grep -oP \'(?<=available: )\\d+\''],
                emit: false,
                capture: true
            },
            callback: (sharedState, result) => {
                sharedState.numaNodes = parseInt(result.stdOut?.trim() || 'NaN');
            }
        }
    ];
}