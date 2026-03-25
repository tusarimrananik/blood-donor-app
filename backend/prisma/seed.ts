import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/prisma.js";

type DonorSeed = {
  id: string;
  name: string;
  phone: string;
  email: string;
  profileImage: string;
  bloodGroup: string;
  area: string;
  lastDonated: Date;
  latitude: number;
  longitude: number;
};

type DonorBlueprint = readonly [string, string, string, number, number, number];
type RequestBlueprint = readonly [string, string, string, string, string, string, string, string, number];

type RequestSeed = {
  requesterName: string;
  requesterPhone: string;
  bloodGroup: string;
  message: string;
  area: string;
  hospital: string;
  urgency: string;
  status: string;
  donorId: string;
};

const donorBlueprints: DonorBlueprint[] = [
  ["Amina Rahman", "A+", "Dhanmondi, Dhaka", 23.7465, 90.3760, 140],
  ["Tanvir Hasan", "B+", "Mirpur 10, Dhaka", 23.8067, 90.3687, 118],
  ["Nusrat Jahan", "O-", "Uttara Sector 7, Dhaka", 23.8759, 90.3795, 156],
  ["Sabbir Ahmed", "AB+", "Mohammadpur, Dhaka", 23.7607, 90.3588, 95],
  ["Farzana Akter", "A-", "Banani, Dhaka", 23.7936, 90.4066, 172],
  ["Mahmudul Islam", "O+", "Bashundhara, Dhaka", 23.8145, 90.4256, 104],
  ["Jannatul Ferdous", "B-", "Wari, Dhaka", 23.7104, 90.4175, 131],
  ["Riad Hossain", "AB-", "Shyamoli, Dhaka", 23.7742, 90.3654, 198],
  ["Tasnia Karim", "A+", "Rampura, Dhaka", 23.7639, 90.4248, 82],
  ["Imran Kabir", "O+", "Badda, Dhaka", 23.7806, 90.4265, 145],
  ["Mst. Sultana", "B+", "Jatrabari, Dhaka", 23.7101, 90.4389, 121],
  ["Sharif Ahmed", "A-", "Lalbagh, Dhaka", 23.7188, 90.3889, 167],
  ["Nabila Noor", "O-", "Pallabi, Dhaka", 23.8284, 90.3652, 111],
  ["Zubair Hossain", "AB+", "Farmgate, Dhaka", 23.7578, 90.3903, 134],
  ["Rafiya Chowdhury", "B-", "Tejgaon, Dhaka", 23.7640, 90.3988, 154],
  ["Adnan Karim", "O+", "Motijheel, Dhaka", 23.7333, 90.4170, 89],
  ["Maliha Islam", "A+", "Khilgaon, Dhaka", 23.7489, 90.4305, 176],
  ["Hasib Hasan", "B+", "Demra, Dhaka", 23.7229, 90.4794, 108],
  ["Ishrat Jahan", "AB-", "Savar, Dhaka", 23.8583, 90.2667, 201],
  ["Sohel Rana", "O-", "Narayanganj", 23.6238, 90.5000, 124],
  ["Tahsin Alam", "A-", "Gazipur", 23.9999, 90.4203, 149],
  ["Mim Akter", "B+", "Tongi, Gazipur", 23.8915, 90.4023, 137],
  ["Rakibul Hasan", "O+", "Keraniganj", 23.6850, 90.3444, 115],
  ["Nadia Tasnim", "AB+", "Mugda, Dhaka", 23.7305, 90.4346, 163],
  ["Jubayer Ahmed", "A+", "Malibagh, Dhaka", 23.7461, 90.4148, 97],
  ["Samia Haque", "B-", "Gulshan 2, Dhaka", 23.7925, 90.4078, 187],
  ["Arman Hridoy", "O-", "Kafrul, Dhaka", 23.7960, 90.3854, 129],
  ["Priyanka Saha", "AB+", "Nikunja, Dhaka", 23.8202, 90.4191, 143],
  ["Fahim Reza", "A+", "Siddhirganj, Narayanganj", 23.6847, 90.5213, 171],
  ["Sadia Rahman", "O+", "Adabor, Dhaka", 23.7721, 90.3539, 102],
  ["Nayeem Islam", "B+", "Kallyanpur, Dhaka", 23.7777, 90.3598, 92],
  ["Tania Sultana", "A-", "Moghbazar, Dhaka", 23.7512, 90.4072, 158],
] as const;

const requestBlueprints = [
  ["Rashed Khan", "01910000001", "A+", "Need blood for emergency surgery tonight.", "Dhanmondi, Dhaka", "City Hospital", "URGENT", "ASSIGNED", 0],
  ["Faria Sultana", "01910000002", "O-", "ICU patient needs O- donor urgently.", "Uttara, Dhaka", "Care Hospital", "URGENT", "OPEN", 2],
  ["Karim Uddin", "01910000003", "B+", "Looking for a donor near Mirpur within the next few hours.", "Mirpur, Dhaka", "Mirpur General", "PRIORITY", "OPEN", 1],
  ["Morsheda Begum", "01910000004", "AB+", "Required for a scheduled transfusion tomorrow morning.", "Mohammadpur, Dhaka", "Dhaka Medical", "STANDARD", "ASSIGNED", 3],
  ["Imtiaz Hossain", "01910000005", "A-", "Patient admitted in Banani needs blood by evening.", "Banani, Dhaka", "Banani Clinic", "PRIORITY", "OPEN", 4],
  ["Sanjida Akter", "01910000006", "O+", "Urgent replacement donor requested from Bashundhara.", "Bashundhara, Dhaka", "Evercare", "URGENT", "OPEN", 5],
  ["Rehana Parvin", "01910000007", "B-", "Seeking a donor for a thalassemia patient.", "Wari, Dhaka", "Shishu Hospital", "STANDARD", "OPEN", 6],
  ["Nabil Hasan", "01910000008", "AB-", "Very urgent need for rare blood group support.", "Shyamoli, Dhaka", "Popular Hospital", "URGENT", "OPEN", 7],
  ["Shawon Ahmed", "01910000009", "A+", "Hospital asked us to arrange one donor by noon.", "Rampura, Dhaka", "Rampura Care", "PRIORITY", "OPEN", 8],
  ["Tasrifa Noor", "01910000010", "O+", "Need donor support near Badda today.", "Badda, Dhaka", "United Hospital", "PRIORITY", "OPEN", 9],
  ["Jahidul Islam", "01910000011", "B+", "Family is searching for a B+ donor quickly.", "Jatrabari, Dhaka", "Islamia Hospital", "PRIORITY", "OPEN", 10],
  ["Rumana Yasmin", "01910000012", "A-", "One unit needed for surgery prep.", "Lalbagh, Dhaka", "Sir Salimullah", "STANDARD", "OPEN", 11],
  ["Arafat Karim", "01910000013", "O-", "Urgent blood requirement for trauma care.", "Pallabi, Dhaka", "National Institute", "URGENT", "OPEN", 12],
  ["Nazia Rahman", "01910000014", "AB+", "Hospital requested an AB+ donor this afternoon.", "Farmgate, Dhaka", "Square Hospital", "PRIORITY", "OPEN", 13],
  ["Saiful Bari", "01910000015", "B-", "Please help arrange a donor around Tejgaon.", "Tejgaon, Dhaka", "Holy Family", "STANDARD", "OPEN", 14],
  ["Jui Akter", "01910000016", "O+", "Need an O+ donor around Motijheel.", "Motijheel, Dhaka", "Central Hospital", "STANDARD", "OPEN", 15],
] as const;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function colorFromName(name: string) {
  const palette = ["#8b1e3f", "#14532d", "#0f766e", "#1d4ed8", "#7c2d12", "#6d28d9"];
  const hash = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[hash % palette.length]!;
}

function avatarDataUri(name: string) {
  const bg = colorFromName(name);
  const text = initials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="120" fill="${bg}"/><text x="120" y="132" text-anchor="middle" font-size="84" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#ffffff">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const donors: DonorSeed[] = donorBlueprints.map(
  ([name, bloodGroup, area, latitude, longitude, donatedDaysAgo], index) => ({
    id: randomUUID(),
    name,
    bloodGroup,
    area,
    latitude,
    longitude,
    lastDonated: daysAgo(donatedDaysAgo),
    phone: `01710${String(index + 1).padStart(6, "0")}`,
    email: name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "") + "@example.com",
    profileImage: avatarDataUri(name),
  }),
);

const requests: RequestSeed[] = requestBlueprints.map(
  ([requesterName, requesterPhone, bloodGroup, message, area, hospital, urgency, status, donorIndex]) => ({
    requesterName,
    requesterPhone,
    bloodGroup,
    message,
    area,
    hospital,
    urgency,
    status,
    donorId: status === "ASSIGNED" ? donors[donorIndex]!.id : "",
  }),
);

async function main() {
  await prisma.$executeRaw`DELETE FROM "requests"`;
  await prisma.$executeRaw`DELETE FROM "request_responses"`;

  await prisma.$executeRaw`DELETE FROM "donors"`;

  for (const donor of donors) {
    await prisma.$executeRaw`
      INSERT INTO "donors" (
        "id",
        "name",
        "phone",
        "email",
        "profileImage",
        "bloodGroup",
        "area",
        "lastDonated",
        "location",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${donor.id},
        ${donor.name},
        ${donor.phone},
        ${donor.email},
        ${donor.profileImage},
        ${donor.bloodGroup},
        ${donor.area},
        ${donor.lastDonated},
        ST_SetSRID(ST_MakePoint(${donor.longitude}, ${donor.latitude}), 4326),
        NOW(),
        NOW()
      )
    `;
  }

  await prisma.request.createMany({
    data: requests.map((request) => ({
      requesterName: request.requesterName,
      requesterPhone: request.requesterPhone,
      bloodGroup: request.bloodGroup,
      message: request.message,
      area: request.area,
      hospital: request.hospital,
      urgency: request.urgency,
      status: request.status,
      donorId: request.donorId || null,
    })),
  });

  console.log(`Seeded ${donors.length} donors and ${requests.length} requests.`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
