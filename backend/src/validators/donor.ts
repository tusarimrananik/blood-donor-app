import { z } from "zod";

export const createDonorSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  phone: z.string().min(8, "Phone is too short"),
  email: z.string().email("Invalid email"),
  bloodGroup: z.string().min(1, "Blood group is required"),
  area: z.string().min(1, "Area is required"),
  lastDonated: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export type CreateDonorInput = z.infer<typeof createDonorSchema>;
