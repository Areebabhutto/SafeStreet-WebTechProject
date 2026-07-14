"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIncidentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateIncidentDto {
}
exports.CreateIncidentDto = CreateIncidentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Large pothole on Main St' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], CreateIncidentDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'A deep pothole has formed near the intersection, causing cars to swerve.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], CreateIncidentDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 37.7749 }),
    (0, class_validator_1.IsLatitude)(),
    __metadata("design:type", Number)
], CreateIncidentDto.prototype, "latitude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: -122.4194 }),
    (0, class_validator_1.IsLongitude)(),
    __metadata("design:type", Number)
], CreateIncidentDto.prototype, "longitude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '123 Main St, Springfield' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateIncidentDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        required: false,
        description: 'Optional Base64 data URL or hosted image URL (mock storage for this project)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateIncidentDto.prototype, "imageUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        required: false,
        description: 'Set true when the citizen has confirmed submission despite a "possible duplicate" warning',
        default: false,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateIncidentDto.prototype, "confirmedNotDuplicate", void 0);
//# sourceMappingURL=create-incident.dto.js.map