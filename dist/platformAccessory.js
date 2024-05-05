"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotionBlindsAccessory = void 0;
const motionblinds_1 = require("motionblinds");
function IsVerticalBlind(blindType) {
    switch (blindType) {
        case motionblinds_1.BlindType.RollerBlind:
        case motionblinds_1.BlindType.VenetianBlind:
        case motionblinds_1.BlindType.RomanBlind:
        case motionblinds_1.BlindType.HoneycombBlind:
        case motionblinds_1.BlindType.ShangriLaBlind:
        case motionblinds_1.BlindType.Awning:
        case motionblinds_1.BlindType.TopDownBottomUp:
        case motionblinds_1.BlindType.DayNightBlind:
        case motionblinds_1.BlindType.DimmingBlind:
        case motionblinds_1.BlindType.DoubleRoller:
        case motionblinds_1.BlindType.Switch:
            return true;
        default:
            return false;
    }
}
class MotionBlindsAccessory {
    constructor(platform, accessory) {
        var _a, _b, _c, _d;
        this.platform = platform;
        this.accessory = accessory;
        this.config = (_a = this.platform.blindConfigs.get(this.mac)) !== null && _a !== void 0 ? _a : { mac: this.mac };
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'MOTION')
            .setCharacteristic(this.platform.Characteristic.Model, motionblinds_1.BlindType[this.status.type])
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.mac);
        // TODO: Support TDBU blinds by creating two separate WindowCovering services
        this.service =
            (_b = this.accessory.getService(this.platform.Service.WindowCovering)) !== null && _b !== void 0 ? _b : this.accessory.addService(this.platform.Service.WindowCovering);
        this.service.setCharacteristic(this.platform.Characteristic.Name, (_c = this.config.name) !== null && _c !== void 0 ? _c : this.mac);
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentPosition)
            .on('get', (callback) => callback(null, this.status.currentPosition));
        this.service
            .getCharacteristic(this.platform.Characteristic.PositionState)
            .on('get', (callback) => callback(null, this.positionState(this.status)));
        // A key is required for write commands
        if (this.platform.gateway.key) {
            this.service
                .getCharacteristic(this.platform.Characteristic.TargetPosition)
                .on('get', (callback) => callback(null, this.accessory.context.targetPosition))
                .on('set', (value, callback) => {
                const targetPosition = value;
                const effectiveTarget = this.config.invert ? targetPosition : 100 - targetPosition;
                this.accessory.context.targetPosition = targetPosition;
                this.platform.log.debug(`-> writeDevice(${this.mac}, targetPosition=${effectiveTarget})`);
                this.platform.gateway
                    .writeDevice(this.mac, this.deviceType, { targetPosition: effectiveTarget })
                    .then(() => {
                    this.platform.log.debug(`<- writeDevice(${this.mac}, targetPosition=${effectiveTarget})`);
                    callback(null);
                })
                    .catch((err) => callback(err));
            });
            this.service
                .getCharacteristic(this.platform.Characteristic.HoldPosition)
                .on('set', (value, callback) => {
                if (!value) {
                    return callback(null, value);
                }
                this.platform.log.debug(`-> writeDevice(${this.mac}, operation=Stop)`);
                this.platform.gateway
                    .writeDevice(this.mac, this.deviceType, { operation: motionblinds_1.Operation.Stop })
                    .then(() => {
                    this.platform.log.debug(`<- writeDevice(${this.mac}, operation=Stop)`);
                    callback(null, value);
                })
                    .catch((err) => callback(err, null));
            });
            if (this.config.tilt) {
                const targetTiltCharacteristic = IsVerticalBlind(this.status.type)
                    ? this.platform.Characteristic.TargetVerticalTiltAngle
                    : this.platform.Characteristic.TargetHorizontalTiltAngle;
                this.service
                    .getCharacteristic(targetTiltCharacteristic)
                    .on('get', (callback) => callback(null, this.accessory.context.targetAngle))
                    .on('set', (value, callback) => {
                    const targetAngle = value;
                    const effectiveTarget = targetAngle; // Convert from [-90, 90] to [0, 180]
                    this.accessory.context.targetAngle = targetAngle;
                    this.platform.log.debug(`-> writeDevice(${this.mac}, targetAngle=${effectiveTarget})`);
                    this.platform.gateway
                        .writeDevice(this.mac, this.deviceType, { targetAngle: effectiveTarget })
                        .then(() => {
                        this.platform.log.debug(`<- writeDevice(${this.mac}, targetAngle=${effectiveTarget})`);
                        callback(null);
                    })
                        .catch((err) => callback(err));
                });
            }
        }
        if (this.config.tilt) {
            const currentTiltCharacteristic = IsVerticalBlind(this.status.type)
                ? this.platform.Characteristic.CurrentVerticalTiltAngle
                : this.platform.Characteristic.CurrentHorizontalTiltAngle;
            this.service
                .getCharacteristic(currentTiltCharacteristic)
                .on('get', (callback) => callback(null, this.status.currentAngle));
        }
        this.battery =
            (_d = this.accessory.getService('Battery')) !== null && _d !== void 0 ? _d : this.accessory.addService(this.platform.Service.Battery, 'Battery', 'Battery-1');
        this.battery
            .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
            .on('get', (callback) => callback(null, this.batteryStatus(this.status)));
        this.battery
            .getCharacteristic(this.platform.Characteristic.BatteryLevel)
            .on('get', (callback) => callback(null, this.batteryLevel(this.status)));
        // Poll for any inconsistent state every 10s
        setInterval(() => {
            this.platform.log.debug(`-> readDevice(${this.mac}, ${this.deviceType})`);
            this.platform.gateway
                .readDevice(this.mac, this.deviceType)
                .then((res) => {
                this.platform.log.debug(`<- readDevice(${this.mac}, ${this.deviceType}) => ${JSON.stringify(res)}`);
                this.updateAccessory(res.data);
            })
                .catch((err) => {
                this.platform.log.error(`readDevice(${this.mac}, ${this.deviceType}) failed:`, err);
            });
        }, 10000);
        this.platform.gateway.on('report', (dev, rinfo) => {
            if (dev.mac === this.mac) {
                const [batteryVoltage, batteryPercent] = motionblinds_1.MotionGateway.BatteryInfo(dev.data.batteryLevel);
                this.platform.log.debug(`[${rinfo.address}] report [${dev.mac} ${motionblinds_1.DEVICE_TYPES[dev.deviceType]}] type=${motionblinds_1.BlindType[dev.data.type]} operation=${motionblinds_1.Operation[dev.data.operation]} currentPosition=${dev.data.currentPosition} currentAngle=${dev.data.currentAngle} currentState=${motionblinds_1.LimitsState[dev.data.currentState]} voltageMode=${motionblinds_1.VoltageMode[dev.data.voltageMode]} batteryLevel=${dev.data.batteryLevel} batteryVoltage=${batteryVoltage} batteryPercent=${batteryPercent} wirelessMode=${motionblinds_1.WirelessMode[dev.data.wirelessMode]} RSSI=${dev.data.RSSI}`);
                this.updateAccessory(dev.data);
            }
            else {
                this.platform.log.debug(`ignoring report from ${rinfo.address} [${dev.mac} ${motionblinds_1.DEVICE_TYPES[dev.deviceType]}]`);
            }
        });
    }
    get mac() {
        return this.accessory.context.mac;
    }
    get deviceType() {
        return this.accessory.context.deviceType;
    }
    get status() {
        return this.accessory.context.status;
    }
    batteryLevel(status) {
        return motionblinds_1.MotionGateway.BatteryInfo(status.batteryLevel)[1] * 100;
    }
    batteryStatus(status) {
        return this.batteryLevel(status) >= 20
            ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
            : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
    }
    positionState(status) {
        const DECREASING = this.platform.Characteristic.PositionState.DECREASING;
        const INCREASING = this.platform.Characteristic.PositionState.INCREASING;
        if (status.operation === motionblinds_1.Operation.CloseDown) {
            return this.config.invert ? INCREASING : DECREASING;
        }
        else if (status.operation === motionblinds_1.Operation.OpenUp) {
            return this.config.invert ? DECREASING : INCREASING;
        }
        return this.platform.Characteristic.PositionState.STOPPED;
    }
    // Broadcast updates for any characteristics that changed, then update `this.accessory.context.status`
    updateAccessory(newStatus) {
        const prevStatus = this.status;
        const prevState = this.positionState(prevStatus);
        const newState = this.positionState(newStatus);
        if (newStatus.currentPosition !== prevStatus.currentPosition) {
            this.platform.log.debug(`$ CurrentPosition (${this.mac}, ${this.deviceType}) ${prevStatus.currentPosition} -> ${newStatus.currentPosition}`);
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, newStatus.currentPosition);
        }
        else {
            this.platform.log.debug(`$ CurrentPosition (${this.mac}, ${this.deviceType}) ${newStatus.currentPosition}`);
        }
        this.platform.log.debug(`$ PositionState (${this.mac}, ${this.deviceType}) ${prevState} -> ${newState}`);
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState, newState);
        if (newState !== prevState && newState === 2) {
            // STOPPED
            this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, newStatus.currentPosition);
            this.service.updateCharacteristic(this.platform.Characteristic.HoldPosition, true);
        }
        if (this.config.tilt) {
            if (newStatus.currentAngle !== prevStatus.currentAngle) {
                this.platform.log.debug(`$ CurrentTiltAngle (${this.mac}, ${this.deviceType}) ${prevStatus.currentAngle} -> ${newStatus.currentAngle}`);
                const currentTiltCharacteristic = IsVerticalBlind(newStatus.type)
                    ? this.platform.Characteristic.CurrentVerticalTiltAngle
                    : this.platform.Characteristic.CurrentHorizontalTiltAngle;
                this.service.updateCharacteristic(currentTiltCharacteristic, newStatus.currentAngle - 90);
            }
            else {
                this.platform.log.debug(`$ CurrentTiltAngle (${this.mac}, ${this.deviceType}) ${newStatus.currentAngle}`);
            }
        }
        const prevBattery = this.batteryLevel(prevStatus);
        const newBattery = this.batteryLevel(newStatus);
        if (prevBattery !== newBattery) {
            this.platform.log.debug(`$ BatteryLevel (${this.mac}, ${this.deviceType}) ${prevBattery} -> ${newBattery}`);
            this.service.updateCharacteristic(this.platform.Characteristic.BatteryLevel, newBattery);
        }
        else {
            this.platform.log.debug(`$ BatteryLevel (${this.mac}, ${this.deviceType}) ${newBattery}`);
        }
        const prevBatteryStatus = this.batteryStatus(prevStatus);
        const newBatteryStatus = this.batteryStatus(newStatus);
        if (prevBatteryStatus !== newBatteryStatus) {
            this.platform.log.debug(`$ BatteryStatus (${this.mac}, ${this.deviceType}) ${prevBatteryStatus} -> ${newBatteryStatus}`);
            this.service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, newBatteryStatus);
        }
        else {
            this.platform.log.debug(`$ BatteryStatus (${this.mac}, ${this.deviceType}) ${newBatteryStatus}`);
        }
        this.accessory.context.status = newStatus;
    }
}
exports.MotionBlindsAccessory = MotionBlindsAccessory;
//# sourceMappingURL=platformAccessory.js.map