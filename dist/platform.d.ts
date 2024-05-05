import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { DeviceStatus, DeviceType, MotionGateway, Report } from 'motionblinds';
export declare type BlindAccessoryConfig = {
    mac: string;
    name?: string;
    tilt?: boolean;
    invert?: boolean;
};
export declare type BlindAccessoryContext = {
    mac?: string;
    deviceType?: DeviceType;
    status?: DeviceStatus;
    targetPosition?: number;
    targetAngle?: number;
};
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export declare class MotionBlindsPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory[];
    readonly blindConfigs: Map<string, BlindAccessoryConfig>;
    readonly gateway: MotionGateway;
    private seenThisSession;
    constructor(log: Logger, config: PlatformConfig, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    discoverDevices(): Promise<void>;
    maybeAddOrUpdateAccessory(mac: string, deviceType: DeviceType, status: DeviceStatus): void;
    addAccessory(mac: string, uuid: string, deviceType: DeviceType, status: DeviceStatus): void;
    handleReport: (report: Report) => void;
}
//# sourceMappingURL=platform.d.ts.map