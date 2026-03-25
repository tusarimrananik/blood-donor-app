import { z } from "zod";
export declare const createDonorSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodString;
    email: z.ZodString;
    bloodGroup: z.ZodString;
    area: z.ZodString;
    lastDonated: z.ZodString;
    lat: z.ZodNumber;
    lon: z.ZodNumber;
}, z.core.$strip>;
export type CreateDonorInput = z.infer<typeof createDonorSchema>;
//# sourceMappingURL=donor.d.ts.map