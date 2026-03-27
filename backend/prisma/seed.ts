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
  dateOfBirth: Date;
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
  createdAt: Date;
};

type ResponseSeed = {
  requestId: string;
  donorId: string;
  createdAt: Date;
};

type NotificationSeed = {
  recipientId: string;
  actorId: string | null;
  requestId: string | null;
  type: string;
  title: string;
  body: string;
  createdAt: Date;
};

type RequestConfig = {
  creator: number;
  bloodGroup: string;
  urgency: RequestSeed["urgency"];
  status: RequestSeed["status"];
  target: number | null;
  donor: number | null;
  area: string;
  hospital: number;
  message: number;
  createdHoursAgo: number;
};

const donorPassword = "bloodlink123";

const maleFirstNames = [
  "Tanvir",
  "Sabbir",
  "Mahmudul",
  "Riad",
  "Imran",
  "Sharif",
  "Zubair",
  "Adnan",
  "Hasib",
  "Sohel",
  "Tahsin",
  "Rakibul",
  "Jubayer",
  "Arman",
  "Fahim",
  "Nayeem",
  "Mehedi",
  "Maruf",
  "Iftekhar",
  "Rafiul",
  "Mahin",
  "Rezaul",
  "Ashikur",
  "Moinul",
  "Sakib",
  "Omar",
  "Shahriar",
  "Shuvo",
  "Alif",
  "Rumman",
  "Nabil",
  "Saif",
  "Rashed",
  "Rasel",
  "Shakil",
  "Towhid",
  "Nafis",
  "Arian",
  "Tariq",
  "Sadman",
  "Rafsan",
  "Ishtiaq",
  "Jawad",
  "Shayan",
  "Masud",
  "Farhan",
  "Munim",
  "Arif",
] as const;

const femaleFirstNames = [
  "Amina",
  "Nusrat",
  "Farzana",
  "Jannatul",
  "Tasnia",
  "Sultana",
  "Nabila",
  "Rafiya",
  "Maliha",
  "Ishrat",
  "Mim",
  "Nadia",
  "Samia",
  "Priyanka",
  "Sadia",
  "Tania",
  "Sadia",
  "Sharmin",
  "Rabeya",
  "Samiha",
  "Toma",
  "Shaila",
  "Nafisa",
  "Moumita",
  "Lamia",
  "Nashita",
  "Anika",
  "Jerin",
  "Tahura",
  "Iffat",
  "Faria",
  "Rumana",
  "Jui",
  "Morsheda",
  "Tasrifa",
  "Rehana",
  "Nazia",
  "Sanjida",
  "Mahiya",
  "Orpa",
  "Raisa",
  "Elma",
  "Suhana",
  "Ritika",
  "Peya",
  "Rupa",
  "Sabrina",
  "Afsana",
] as const;

const lastNames = [
  "Rahman",
  "Hasan",
  "Jahan",
  "Ahmed",
  "Akter",
  "Islam",
  "Ferdous",
  "Hossain",
  "Karim",
  "Kabir",
  "Noor",
  "Chowdhury",
  "Alam",
  "Tasnim",
  "Haque",
  "Sultana",
  "Afrin",
  "Anjum",
  "Roy",
  "Das",
  "Mahmud",
  "Sattar",
  "Tabassum",
  "Binte",
  "Khatun",
  "Uddin",
  "Yasmin",
  "Parvin",
  "Bari",
  "Begum",
  "Faruq",
  "Imon",
  "Hridoy",
  "Rana",
  "Reza",
  "Khan",
  "Mim",
  "Nawar",
  "Arefin",
  "Nahar",
] as const;

const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

const clusters: Cluster[] = [
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
  { area: "Dhanmondi, Dhaka", lat: 23.7465, lon: 90.3760 },
  { area: "Mirpur 10, Dhaka", lat: 23.8067, lon: 90.3687 },
  { area: "Uttara Sector 7, Dhaka", lat: 23.8759, lon: 90.3795 },
  { area: "Mohammadpur, Dhaka", lat: 23.7607, lon: 90.3588 },
  { area: "Banani, Dhaka", lat: 23.7936, lon: 90.4066 },
  { area: "Bashundhara, Dhaka", lat: 23.8145, lon: 90.4256 },
  { area: "Rampura, Dhaka", lat: 23.7639, lon: 90.4248 },
  { area: "Badda, Dhaka", lat: 23.7806, lon: 90.4265 },
  { area: "Agrabad, Chattogram", lat: 22.3193, lon: 91.8114 },
  { area: "Khulna Sadar, Khulna", lat: 22.8456, lon: 89.5403 },
  { area: "Zindabazar, Sylhet", lat: 24.8967, lon: 91.8717 },
  { area: "Rangpur Sadar, Rangpur", lat: 25.7439, lon: 89.2752 },
  { area: "Bogra Sadar, Bogura", lat: 24.8510, lon: 89.3697 },
  { area: "Mymensingh Town Hall, Mymensingh", lat: 24.7471, lon: 90.4203 },
  { area: "Barishal Sadar, Barishal", lat: 22.7010, lon: 90.3535 },
  { area: "Cumilla Kandirpar, Cumilla", lat: 23.4607, lon: 91.1809 },
  { area: "Jessore Sadar, Jashore", lat: 23.1664, lon: 89.2137 },
  { area: "Pabna Sadar, Pabna", lat: 24.0064, lon: 89.2372 },
  { area: "Natore Sadar, Natore", lat: 24.4206, lon: 89.0003 },
  { area: "Gazipur Chowrasta, Gazipur", lat: 24.0023, lon: 90.4203 },
  { area: "Narayanganj Sadar, Narayanganj", lat: 23.6238, lon: 90.5000 },
  { area: "Maijdee Court, Noakhali", lat: 22.8696, lon: 91.0995 },
] as const;

const hospitals = [
  "Rajshahi Medical College Hospital",
  "Islami Bank Medical College Hospital",
  "Dhaka Medical College Hospital",
  "Square Hospital",
  "Evercare Hospital Dhaka",
  "United Hospital",
  "Chattogram Medical College Hospital",
  "Khulna City Medical College",
  "Sylhet MAG Osmani Medical College",
  "Sher-e-Bangla Medical College Hospital",
  "Mymensingh Medical College Hospital",
  "Cumilla Medical College Hospital",
  "Popular Diagnostic Center",
  "Central Hospital",
] as const;

const requestMessages = [
  "Emergency surgery tonight. Need one donor as soon as possible.",
  "ICU patient needs support within a few hours.",
  "Child patient scheduled for transfusion tomorrow morning.",
  "Replacement donor requested by the hospital before evening rounds.",
  "Two units may be needed for a trauma case.",
  "Family is arranging blood urgently and needs a nearby donor.",
  "Thalassemia patient needs a confirmed donor this week.",
  "Rare group request and we are short on time.",
] as const;

function seededOffset(index: number, multiplier: number) {
  const wave = ((index * multiplier) % 17) - 8;
  return wave * 0.0026;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function yearsAgo(years: number, extraDays: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setDate(date.getDate() - extraDays);
  return date;
}

function donorNameFor(index: number) {
  const useFemale = index % 2 === 0;
  const firstName = useFemale
    ? femaleFirstNames[Math.floor(index / 2) % femaleFirstNames.length]!
    : maleFirstNames[Math.floor(index / 2) % maleFirstNames.length]!;
  const lastName = lastNames[(index * 3) % lastNames.length]!;
  return `${firstName} ${lastName}`;
}

function emailFor(name: string, index: number) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return `${slug}.${index + 1}@bloodlink.demo`;
}

function profileImageFor(index: number) {
  const isFemale = index % 2 === 0;
  const bucket = index % 50;
  const group = isFemale ? "women" : "men";
  return `https://randomuser.me/api/portraits/${group}/${bucket}.jpg`;
}

const donors: DonorSeed[] = Array.from({ length: 96 }, (_, index) => {
  const cluster = clusters[index % clusters.length]!;
  const latitude = cluster.lat + seededOffset(index, 7);
  const longitude = cluster.lon + seededOffset(index, 11);
  const name = donorNameFor(index);
  const bloodGroup = bloodGroups[index % bloodGroups.length]!;
  const gender = index % 2 === 0 ? "Female" : "Male";
  const canDonate = index % 11 !== 0;
  const firstTimeDonor = index % 7 === 0;

  return {
    id: randomUUID(),
    name,
    phone: `01730${String(index + 1).padStart(6, "0")}`,
    email: emailFor(name, index),
    passwordHash: hashPassword(donorPassword),
    profileImage: profileImageFor(index),
    bloodGroup,
    area: cluster.area,
    lastDonated: firstTimeDonor ? null : daysAgo(95 + (index % 10) * 16),
    gender,
    dateOfBirth: yearsAgo(19 + (index % 18), (index * 9) % 120),
    canDonate,
    latitude,
    longitude,
  };
});

const requestConfigs: RequestConfig[] = [
  { creator: 4, bloodGroup: "A-", urgency: "URGENT", status: "OPEN", target: null, donor: null, area: "Laxmipur, Rajshahi", hospital: 0, message: 0, createdHoursAgo: 2 },
  { creator: 6, bloodGroup: "O+", urgency: "PRIORITY", status: "OPEN", target: 22, donor: null, area: "Kazla, Rajshahi", hospital: 1, message: 2, createdHoursAgo: 6 },
  { creator: 10, bloodGroup: "B+", urgency: "PRIORITY", status: "ASSIGNED", target: null, donor: 17, area: "Mirpur 10, Dhaka", hospital: 2, message: 3, createdHoursAgo: 9 },
  { creator: 15, bloodGroup: "AB+", urgency: "STANDARD", status: "OPEN", target: null, donor: null, area: "Agrabad, Chattogram", hospital: 6, message: 6, createdHoursAgo: 15 },
  { creator: 20, bloodGroup: "O-", urgency: "URGENT", status: "ASSIGNED", target: 27, donor: 27, area: "Saheb Bazar, Rajshahi", hospital: 0, message: 4, createdHoursAgo: 18 },
  { creator: 24, bloodGroup: "A+", urgency: "STANDARD", status: "OPEN", target: null, donor: null, area: "Khulna Sadar, Khulna", hospital: 7, message: 5, createdHoursAgo: 21 },
  { creator: 31, bloodGroup: "B-", urgency: "PRIORITY", status: "OPEN", target: null, donor: null, area: "Court Station, Rajshahi", hospital: 0, message: 1, createdHoursAgo: 25 },
  { creator: 40, bloodGroup: "AB-", urgency: "URGENT", status: "OPEN", target: null, donor: null, area: "Zindabazar, Sylhet", hospital: 8, message: 7, createdHoursAgo: 30 },
  { creator: 47, bloodGroup: "O+", urgency: "STANDARD", status: "COMPLETED", target: null, donor: 52, area: "Barishal Sadar, Barishal", hospital: 9, message: 2, createdHoursAgo: 42 },
  { creator: 53, bloodGroup: "A+", urgency: "PRIORITY", status: "ASSIGNED", target: 58, donor: 58, area: "Cumilla Kandirpar, Cumilla", hospital: 11, message: 0, createdHoursAgo: 50 },
  { creator: 61, bloodGroup: "B+", urgency: "PRIORITY", status: "CANCELLED", target: null, donor: null, area: "Gazipur Chowrasta, Gazipur", hospital: 12, message: 5, createdHoursAgo: 58 },
  { creator: 69, bloodGroup: "O-", urgency: "URGENT", status: "OPEN", target: 74, donor: null, area: "Narayanganj Sadar, Narayanganj", hospital: 13, message: 4, createdHoursAgo: 63 },
  { creator: 75, bloodGroup: "AB+", urgency: "PRIORITY", status: "OPEN", target: null, donor: null, area: "Jessore Sadar, Jashore", hospital: 12, message: 6, createdHoursAgo: 72 },
  { creator: 82, bloodGroup: "A-", urgency: "STANDARD", status: "OPEN", target: null, donor: null, area: "Maijdee Court, Noakhali", hospital: 3, message: 1, createdHoursAgo: 84 },
  { creator: 88, bloodGroup: "B-", urgency: "PRIORITY", status: "ASSIGNED", target: 91, donor: 91, area: "Uttara Sector 7, Dhaka", hospital: 4, message: 3, createdHoursAgo: 96 },
  { creator: 93, bloodGroup: "O+", urgency: "URGENT", status: "OPEN", target: null, donor: null, area: "Badda, Dhaka", hospital: 5, message: 0, createdHoursAgo: 108 },
];

const requests: RequestSeed[] = requestConfigs.map((config, index) => {
  const creator = donors[config.creator]!;

  return {
    id: randomUUID(),
    createdById: creator.id,
    requesterName: creator.name,
    requesterPhone: creator.phone,
    bloodGroup: config.bloodGroup,
    message: requestMessages[config.message]!,
    area: config.area,
    hospital: hospitals[config.hospital]!,
    urgency: config.urgency,
    status: config.status,
    targetDonorId: config.target === null ? null : donors[config.target]!.id,
    donorId: config.donor === null ? null : donors[config.donor]!.id,
    createdAt: hoursAgo(config.createdHoursAgo + index),
  };
});

const responsePairs = [
  [0, 36, 1],
  [0, 44, 2],
  [1, 22, 4],
  [3, 39, 7],
  [3, 55, 9],
  [5, 48, 12],
  [6, 57, 15],
  [7, 63, 18],
  [8, 52, 22],
  [9, 58, 25],
  [11, 74, 28],
  [12, 79, 31],
  [13, 85, 35],
  [15, 94, 39],
] as const;

const responses: ResponseSeed[] = responsePairs.map(([requestIndex, donorIndex, createdHoursAgo]) => ({
  requestId: requests[requestIndex]!.id,
  donorId: donors[donorIndex]!.id,
  createdAt: hoursAgo(createdHoursAgo),
}));

const notifications: NotificationSeed[] = [
  {
    recipientId: donors[22]!.id,
    actorId: donors[6]!.id,
    requestId: requests[1]!.id,
    type: "REQUEST_RECEIVED",
    title: "New direct blood request",
    body: `${donors[6]!.name} sent you a direct O+ request in Rajshahi.`,
    createdAt: hoursAgo(3),
  },
  {
    recipientId: donors[4]!.id,
    actorId: donors[36]!.id,
    requestId: requests[0]!.id,
    type: "REQUEST_RESPONSE",
    title: "A donor responded",
    body: `${donors[36]!.name} volunteered for your emergency request.`,
    createdAt: hoursAgo(5),
  },
  {
    recipientId: donors[27]!.id,
    actorId: donors[20]!.id,
    requestId: requests[4]!.id,
    type: "REQUEST_ACCEPTED",
    title: "Direct request accepted",
    body: `${donors[20]!.name} accepted your direct donor response.`,
    createdAt: hoursAgo(8),
  },
  {
    recipientId: donors[58]!.id,
    actorId: donors[53]!.id,
    requestId: requests[9]!.id,
    type: "REQUEST_RECEIVED",
    title: "Targeted request sent",
    body: `${donors[53]!.name} needs A+ blood support in Cumilla.`,
    createdAt: hoursAgo(12),
  },
  {
    recipientId: donors[88]!.id,
    actorId: donors[91]!.id,
    requestId: requests[14]!.id,
    type: "REQUEST_MATCHED",
    title: "Donor assigned",
    body: `${donors[91]!.name} has been assigned to your request in Uttara.`,
    createdAt: hoursAgo(18),
  },
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
        ${request.createdAt}
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
        ${response.createdAt}
      )
    `;
  }

  for (const item of notifications) {
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
        ${item.createdAt}
      )
    `;
  }

  console.log(`Seeded ${donors.length} donors, ${requests.length} requests, ${responses.length} responses, and ${notifications.length} notifications.`);
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
