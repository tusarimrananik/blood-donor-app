import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/auth.js";
import { prisma } from "../src/prisma.js";

type Cluster = {
  area: string;
  lat: number;
  lon: number;
};

type DonorSeed = {
  id: string;
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  profileImage: string;
  bloodGroup: string;
  area: string;
  lastDonated: Date | null;
  gender: string | null;
  dateOfBirth: Date | null;
  canDonate: boolean;
  latitude: number;
  longitude: number;
};

type RequestSeed = {
  id: string;
  createdById: string;
  requesterName: string;
  requesterPhone: string;
  bloodGroup: string;
  message: string;
  area: string;
  hospital: string;
  urgency: "STANDARD" | "PRIORITY" | "URGENT";
  status: "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
  targetDonorId: string | null;
  donorId: string | null;
};

type ResponseSeed = {
  requestId: string;
  donorId: string;
};

const donorPassword = "bloodlink123";

const names = [
  "Amina Rahman",
  "Tanvir Hasan",
  "Nusrat Jahan",
  "Sabbir Ahmed",
  "Farzana Akter",
  "Mahmudul Islam",
  "Jannatul Ferdous",
  "Riad Hossain",
  "Tasnia Karim",
  "Imran Kabir",
  "Mst Sultana",
  "Sharif Ahmed",
  "Nabila Noor",
  "Zubair Hossain",
  "Rafiya Chowdhury",
  "Adnan Karim",
  "Maliha Islam",
  "Hasib Hasan",
  "Ishrat Jahan",
  "Sohel Rana",
  "Tahsin Alam",
  "Mim Akter",
  "Rakibul Hasan",
  "Nadia Tasnim",
  "Jubayer Ahmed",
  "Samia Haque",
  "Arman Hridoy",
  "Priyanka Saha",
  "Fahim Reza",
  "Sadia Rahman",
  "Nayeem Islam",
  "Tania Sultana",
  "Mehedi Hasan",
  "Sadia Afrin",
  "Maruf Alim",
  "Sharmin Akter",
  "Rabeya Khatun",
  "Iftekhar Alam",
  "Samiha Noor",
  "Rafiul Karim",
  "Toma Roy",
  "Mahin Ahmed",
  "Shaila Yasmin",
  "Rezaul Kabir",
  "Nafisa Islam",
  "Ashikur Rahman",
  "Moumita Das",
  "Moinul Haque",
  "Lamia Anjum",
  "Sakib Mahmud",
  "Nashita Sattar",
  "Omar Faruq",
  "Anika Tabassum",
  "Shahriar Imon",
  "Jerin Akter",
  "Shuvo Roy",
  "Tahura Binte",
  "Alif Hasan",
  "Iffat Jahan",
  "Rumman Hossain",
] as const;

const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const genders = ["Female", "Male", "Female", "Male", "Female", "Male", null] as const;

const rajshahiClusters: Cluster[] = [
  { area: "Saheb Bazar, Rajshahi", lat: 24.3692, lon: 88.6042 },
  { area: "Laxmipur, Rajshahi", lat: 24.3678, lon: 88.6187 },
  { area: "Uposhohor, Rajshahi", lat: 24.3798, lon: 88.5961 },
  { area: "Kazla, Rajshahi", lat: 24.3844, lon: 88.6249 },
  { area: "Shiroil, Rajshahi", lat: 24.3728, lon: 88.6335 },
  { area: "Padma Residential, Rajshahi", lat: 24.3558, lon: 88.5924 },
  { area: "Binodpur, Rajshahi", lat: 24.3632, lon: 88.6396 },
  { area: "Court Station, Rajshahi", lat: 24.3614, lon: 88.6001 },
  { area: "Railgate, Rajshahi", lat: 24.3734, lon: 88.6116 },
  { area: "Bhadra, Rajshahi", lat: 24.3811, lon: 88.6089 },
];

const nationalClusters: Cluster[] = [
  { area: "Dhanmondi, Dhaka", lat: 23.7465, lon: 90.376 },
  { area: "Mirpur 10, Dhaka", lat: 23.8067, lon: 90.3687 },
  { area: "Uttara Sector 7, Dhaka", lat: 23.8759, lon: 90.3795 },
  { area: "Agrabad, Chattogram", lat: 22.3193, lon: 91.8114 },
  { area: "Khulna Sadar, Khulna", lat: 22.8456, lon: 89.5403 },
  { area: "Zindabazar, Sylhet", lat: 24.8967, lon: 91.8717 },
  { area: "Rangpur Sadar, Rangpur", lat: 25.7439, lon: 89.2752 },
  { area: "Bogra Sadar, Bogura", lat: 24.851, lon: 89.3697 },
  { area: "Mymensingh Town Hall, Mymensingh", lat: 24.7471, lon: 90.4203 },
  { area: "Barishal Sadar, Barishal", lat: 22.701, lon: 90.3535 },
  { area: "Cumilla Kandirpar, Cumilla", lat: 23.4607, lon: 91.1809 },
  { area: "Jessore Sadar, Jashore", lat: 23.1664, lon: 89.2137 },
  { area: "Pabna Sadar, Pabna", lat: 24.0064, lon: 89.2372 },
  { area: "Natore Sadar, Natore", lat: 24.4206, lon: 89.0003 },
];

const clusters = [...rajshahiClusters, ...rajshahiClusters, ...nationalClusters];

function seededOffset(index: number, multiplier: number) {
  const wave = ((index * multiplier) % 17) - 8;
  return wave * 0.0026;
}

function profileImageFor(name: string, index: number) {
  const seed = encodeURIComponent(`${name}-${index}`);
  return `https://api.dicebear.com/9.x/initials/png?seed=${seed}&backgroundType=gradientLinear&backgroundColor=f6d6e3,d9e9ff,ffe0d1,bde7d8`;
}

function yearsAgo(years: number, extraDays: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setDate(date.getDate() - extraDays);
  return date;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const donors: DonorSeed[] = names.map((name, index) => {
  const cluster = clusters[index % clusters.length]!;
  const latitude = cluster.lat + seededOffset(index, 7);
  const longitude = cluster.lon + seededOffset(index, 11);
  const bloodGroup = bloodGroups[index % bloodGroups.length]!;
  const gender = genders[index % genders.length] ?? null;
  const canDonate = index % 9 !== 0;
  const firstTimeDonor = index % 6 === 0;
  const lastDonated = firstTimeDonor ? null : daysAgo(92 + (index % 8) * 18);

  return {
    id: randomUUID(),
    name,
    phone: `01730${String(index + 1).padStart(6, "0")}`,
    email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")}@bloodlink.demo`,
    passwordHash: hashPassword(donorPassword),
    profileImage: profileImageFor(name, index),
    bloodGroup,
    area: cluster.area,
    lastDonated,
    gender,
    dateOfBirth: yearsAgo(20 + (index % 14), index % 90),
    canDonate,
    latitude,
    longitude,
  };
});

const requests: RequestSeed[] = [
  {
    id: randomUUID(),
    createdById: donors[4]!.id,
    requesterName: donors[4]!.name,
    requesterPhone: donors[4]!.phone,
    bloodGroup: "A-",
    message: "Emergency surgery tonight. Need one donor as soon as possible in Rajshahi.",
    area: "Laxmipur, Rajshahi",
    hospital: "Rajshahi Medical College Hospital",
    urgency: "URGENT",
    status: "OPEN",
    targetDonorId: null,
    donorId: null,
  },
  {
    id: randomUUID(),
    createdById: donors[6]!.id,
    requesterName: donors[6]!.name,
    requesterPhone: donors[6]!.phone,
    bloodGroup: "O+",
    message: "Blood needed for a child patient tomorrow morning.",
    area: "Kazla, Rajshahi",
    hospital: "Islami Bank Medical College Hospital",
    urgency: "PRIORITY",
    status: "OPEN",
    targetDonorId: donors[22]!.id,
    donorId: null,
  },
  {
    id: randomUUID(),
    createdById: donors[10]!.id,
    requesterName: donors[10]!.name,
    requesterPhone: donors[10]!.phone,
    bloodGroup: "B+",
    message: "Looking for one donor by this evening in Dhaka.",
    area: "Mirpur 10, Dhaka",
    hospital: "Shaheed Suhrawardy Medical College",
    urgency: "PRIORITY",
    status: "ASSIGNED",
    targetDonorId: null,
    donorId: donors[17]!.id,
  },
  {
    id: randomUUID(),
    createdById: donors[15]!.id,
    requesterName: donors[15]!.name,
    requesterPhone: donors[15]!.phone,
    bloodGroup: "AB+",
    message: "Scheduled transfusion support needed tomorrow afternoon.",
    area: "Agrabad, Chattogram",
    hospital: "Chattogram Medical College Hospital",
    urgency: "STANDARD",
    status: "OPEN",
    targetDonorId: null,
    donorId: null,
  },
  {
    id: randomUUID(),
    createdById: donors[20]!.id,
    requesterName: donors[20]!.name,
    requesterPhone: donors[20]!.phone,
    bloodGroup: "O-",
    message: "Critical trauma patient needs O- within the next hour.",
    area: "Saheb Bazar, Rajshahi",
    hospital: "Rajshahi Medical College Hospital",
    urgency: "URGENT",
    status: "ASSIGNED",
    targetDonorId: donors[27]!.id,
    donorId: donors[27]!.id,
  },
  {
    id: randomUUID(),
    createdById: donors[24]!.id,
    requesterName: donors[24]!.name,
    requesterPhone: donors[24]!.phone,
    bloodGroup: "A+",
    message: "Need support for a planned operation this week.",
    area: "Khulna Sadar, Khulna",
    hospital: "Khulna City Medical College",
    urgency: "STANDARD",
    status: "OPEN",
    targetDonorId: null,
    donorId: null,
  },
  {
    id: randomUUID(),
    createdById: donors[31]!.id,
    requesterName: donors[31]!.name,
    requesterPhone: donors[31]!.phone,
    bloodGroup: "B-",
    message: "Need a donor around Rajshahi court area by tomorrow morning.",
    area: "Court Station, Rajshahi",
    hospital: "Rajshahi Christian Mission Hospital",
    urgency: "PRIORITY",
    status: "OPEN",
    targetDonorId: null,
    donorId: null,
  },
  {
    id: randomUUID(),
    createdById: donors[40]!.id,
    requesterName: donors[40]!.name,
    requesterPhone: donors[40]!.phone,
    bloodGroup: "AB-",
    message: "Rare blood group support needed urgently in Sylhet.",
    area: "Zindabazar, Sylhet",
    hospital: "Sylhet MAG Osmani Medical College",
    urgency: "URGENT",
    status: "OPEN",
    targetDonorId: null,
    donorId: null,
  },
];

const responses: ResponseSeed[] = [
  { requestId: requests[0]!.id, donorId: donors[36]!.id },
  { requestId: requests[0]!.id, donorId: donors[44]!.id },
  { requestId: requests[3]!.id, donorId: donors[39]!.id },
  { requestId: requests[3]!.id, donorId: donors[55]!.id },
  { requestId: requests[5]!.id, donorId: donors[48]!.id },
  { requestId: requests[6]!.id, donorId: donors[57]!.id },
];

async function main() {
  await prisma.$executeRaw`DELETE FROM "notifications"`;
  await prisma.$executeRaw`DELETE FROM "push_tokens"`;
  await prisma.$executeRaw`DELETE FROM "request_responses"`;
  await prisma.$executeRaw`DELETE FROM "requests"`;
  await prisma.$executeRaw`DELETE FROM "donors"`;

  for (const donor of donors) {
    await prisma.$executeRaw`
      INSERT INTO "donors" (
        "id",
        "name",
        "phone",
        "email",
        "passwordHash",
        "profileImage",
        "bloodGroup",
        "area",
        "lastDonated",
        "gender",
        "dateOfBirth",
        "canDonate",
        "location",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${donor.id},
        ${donor.name},
        ${donor.phone},
        ${donor.email},
        ${donor.passwordHash},
        ${donor.profileImage},
        ${donor.bloodGroup},
        ${donor.area},
        ${donor.lastDonated},
        ${donor.gender},
        ${donor.dateOfBirth},
        ${donor.canDonate},
        ST_SetSRID(ST_MakePoint(${donor.longitude}, ${donor.latitude}), 4326),
        NOW(),
        NOW()
      )
    `;
  }

  for (const request of requests) {
    await prisma.$executeRaw`
      INSERT INTO "requests" (
        "id",
        "requesterName",
        "requesterPhone",
        "bloodGroup",
        "message",
        "area",
        "hospital",
        "urgency",
        "status",
        "targetDonorId",
        "donorId",
        "createdById",
        "createdAt"
      )
      VALUES (
        ${request.id},
        ${request.requesterName},
        ${request.requesterPhone},
        ${request.bloodGroup},
        ${request.message},
        ${request.area},
        ${request.hospital},
        ${request.urgency},
        ${request.status},
        ${request.targetDonorId},
        ${request.donorId},
        ${request.createdById},
        NOW() - (${Math.floor(Math.random() * 96)} * INTERVAL '1 hour')
      )
    `;
  }

  for (const response of responses) {
    await prisma.$executeRaw`
      INSERT INTO "request_responses" (
        "id",
        "requestId",
        "donorId",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${response.requestId},
        ${response.donorId},
        NOW() - (${Math.floor(Math.random() * 48)} * INTERVAL '1 hour')
      )
    `;
  }

  const notificationTargets = [
    {
      recipientId: donors[22]!.id,
      actorId: donors[6]!.id,
      requestId: requests[1]!.id,
      type: "REQUEST_RECEIVED",
      title: "New direct blood request",
      body: `${donors[6]!.name} sent you a direct O+ request in Rajshahi.`,
    },
    {
      recipientId: donors[4]!.id,
      actorId: donors[36]!.id,
      requestId: requests[0]!.id,
      type: "REQUEST_RESPONSE",
      title: "A donor responded",
      body: `${donors[36]!.name} volunteered for your emergency request.`,
    },
    {
      recipientId: donors[27]!.id,
      actorId: donors[20]!.id,
      requestId: requests[4]!.id,
      type: "REQUEST_ACCEPTED",
      title: "Direct request accepted",
      body: `${donors[20]!.name} accepted your direct donor response.`,
    },
  ];

  for (const item of notificationTargets) {
    await prisma.$executeRaw`
      INSERT INTO "notifications" (
        "id",
        "recipientId",
        "actorId",
        "requestId",
        "type",
        "title",
        "body",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${item.recipientId},
        ${item.actorId},
        ${item.requestId},
        ${item.type},
        ${item.title},
        ${item.body},
        NOW() - (${Math.floor(Math.random() * 24)} * INTERVAL '1 hour')
      )
    `;
  }

  console.log(`Seeded ${donors.length} donors, ${requests.length} requests, and ${responses.length} responses.`);
  console.log(`Seeded donor login password: ${donorPassword}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
