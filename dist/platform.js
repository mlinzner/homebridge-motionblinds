"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotionBlindsPlatform = void 0;
const motionblinds_1 = require("motionblinds");
const settings_1 = require("./settings");
const platformAccessory_1 = require("./platformAccessory");
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
class MotionBlindsPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.accessories = [];
        this.blindConfigs = new Map();
        this.seenThisSession = new Set();
        this.handleReport = (report) => {
            this.maybeAddOrUpdateAccessory(report.mac, report.deviceType, report.data);
        };
        // Load any configured blinds into a map
        if (Array.isArray(this.config.blinds)) {
            for (const entry of this.config.blinds) {
                if (typeof entry.mac !== 'string') {
                    this.log.error('Blinds config entry is missing "mac", ignoring');
                }
                else {
                    this.blindConfigs.set(entry.mac, entry);
                }
            }
        }
        this.gateway = new motionblinds_1.MotionGateway({ key: config.key, gatewayIp: config.gatewayIp });
        this.log.debug('Finished initializing platform:', this.config.name);
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback');
            this.gateway.on('report', this.handleReport);
            this.discoverDevices();
        });
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    async discoverDevices() {
        try {
            this.log.debug('-> readAllDevices()');
            const devices = await this.gateway.readAllDevices();
            const newUUIDs = new Set(devices.map((d) => this.api.hap.uuid.generate(d.mac)));
            this.log.debug(`<- readAllDevices() found ${devices.length} devices, uuids=${[...newUUIDs].join(', ')}`);
            // Add newly discovered and previously discovered devices
            for (const device of devices) {
                if (device.deviceType === motionblinds_1.DEVICE_TYPE_BLIND)
                    this.maybeAddOrUpdateAccessory(device.mac, device.deviceType, device.data);
            }
            // Remove previously discovered devices that no longer exist
            const removed = this.accessories.filter((a) => !newUUIDs.has(a.UUID));
            if (removed.length) {
                this.log.warn(`Removing ${removed.length} accessories that are no longer present`);
                for (const accessory of removed) {
                    this.accessories.splice(this.accessories.indexOf(accessory), 1);
                }
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, removed);
            }
        }
        catch (err) {
            this.log.error('Failed fetching list of MOTION Blinds:', err);
        }
    }
    maybeAddOrUpdateAccessory(mac, deviceType, status) {
        if (this.seenThisSession.has(mac)) {
            return;
        }
        this.seenThisSession.add(mac);
        const uuid = this.api.hap.uuid.generate(mac);
        const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
        if (existingAccessory) {
            // the accessory already exists
            this.log.info(`Restoring existing accessory from cache [${existingAccessory.displayName}], status=${JSON.stringify(status)}`);
            existingAccessory.context.status = status;
            this.api.updatePlatformAccessories([existingAccessory]);
            new platformAccessory_1.MotionBlindsAccessory(this, existingAccessory);
        }
        else {
            this.log.info(`Adding new accessory: mac=${mac}, uuid=${uuid}, deviceType=${motionblinds_1.DEVICE_TYPES[deviceType]}, status=${JSON.stringify(status)}`);
            this.addAccessory(mac, uuid, deviceType, status);
        }
    }
    addAccessory(mac, uuid, deviceType, status) {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', mac);
        // create a new accessory
        const accessory = new this.api.platformAccessory(mac, uuid);
        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.mac = mac;
        accessory.context.deviceType = deviceType;
        accessory.context.status = status;
        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new platformAccessory_1.MotionBlindsAccessory(this, accessory);
        // link the accessory to your platform
        this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
    }
}
exports.MotionBlindsPlatform = MotionBlindsPlatform;
//# sourceMappingURL=platform.js.map