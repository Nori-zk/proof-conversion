import * as os from 'os';
import { ComputationalStage, ComputationPlan } from '../../plan.js';

export interface PlatformFeatures {
    platformName: 'linux' | 'windows' | 'darwin';
    numactl?: boolean;
    numaNodes?: number;
}

export class PlatformFeatureDetectionComputationalPlan implements ComputationPlan<PlatformFeatures, PlatformFeatures> {
    sharedState: PlatformFeatures = {} as PlatformFeatures;
    name = 'PlatformFeatureDetection';
    stages: ComputationalStage<PlatformFeatures>[] = [
        {
            type: 'main-thread',
            name: "PlatformDetection",
            execute: (sharedState) => {
                sharedState.platformName = os.platform() as 'linux' | 'windows' | 'darwin';
            },
        },
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
        },
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
    async collect(sharedState: PlatformFeatures) {
        return sharedState;
    }
}