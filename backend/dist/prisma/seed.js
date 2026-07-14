"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const DEPARTMENTS = [
    { name: 'Roads & Transportation', code: 'ROADS', description: 'Potholes, road damage, signage' },
    { name: 'Sanitation', code: 'SANITATION', description: 'Garbage, illegal dumping, litter' },
    { name: 'Water Utilities', code: 'WATER', description: 'Leaks, drainage, water main issues' },
    { name: 'Electrical', code: 'ELECTRICAL', description: 'Streetlights, power lines' },
    { name: 'Parks & Recreation', code: 'PARKS', description: 'Trees, park facilities' },
    { name: 'Public Safety', code: 'PUBLIC_SAFETY', description: 'Hazards posing immediate risk' },
    { name: 'General / Unclassified', code: 'OTHER', description: 'Fallback queue for manual triage' },
];
async function main() {
    for (const dept of DEPARTMENTS) {
        await prisma.department.upsert({
            where: { code: dept.code },
            update: {},
            create: dept,
        });
    }
    console.log(`Seeded ${DEPARTMENTS.length} departments.`);
    const adminEmail = 'admin@safestreet.local';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
        const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
        await prisma.user.create({
            data: {
                email: adminEmail,
                passwordHash,
                fullName: 'SafeStreet Admin',
                role: client_1.Role.ADMIN,
                isActive: true,
            },
        });
        console.log(`Seeded default admin: ${adminEmail} / ChangeMe123! (change this immediately)`);
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map