import type { PlatformAccessory } from 'homebridge';
import { DeviceStatus, DeviceType } from 'motionblinds';
import { BlindAccessoryContext, MotionBlindsPlatform } from './platform';
export declare class MotionBlindsAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private battery;
    private config;
    constructor(platform: MotionBlindsPlatform, accessory: PlatformAccessory<BlindAccessoryContext>);
    get mac(): string;
    get deviceType(): DeviceType;
    get status(): DeviceStatus;
    batteryLevel(status: DeviceStatus): number;
    batteryStatus(status: DeviceStatus): 1 | 0;
    positionState(status: DeviceStatus): 0 | 1 | 2;
    updateAccessory(newStatus: DeviceStatus): void;
}
//# sourceMappingURL=platformAccessory.d.ts.map