import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/prisma.js";

type DonorSeed = {
  id: string;
  name: string;
  phone: string;
  email: string;
  bloodGroup: string;
  area: string;
  lastDonated: Date;
  latitude: number;
  longitude: number;
};

const donorBlueprints = [
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
  ["Rashed Khan", "01910000001", "A+", "Need blood for emergency surgery tonight.", 0],
  ["Faria Sultana", "01910000002", "O-", "ICU patient needs O- donor urgently.", 2],
  ["Karim Uddin", "01910000003", "B+", "Looking for a donor near Mirpur within the next few hours.", 1],
  ["Morsheda Begum", "01910000004", "AB+", "Required for a scheduled transfusion tomorrow morning.", 3],
  ["Imtiaz Hossain", "01910000005", "A-", "Patient admitted in Banani needs blood by evening.", 4],
  ["Sanjida Akter", "01910000006", "O+", "Urgent replacement donor requested from Bashundhara.", 5],
  ["Rehana Parvin", "01910000007", "B-", "Seeking a donor for a thalassemia patient.", 6],
  ["Nabil Hasan", "01910000008", "AB-", "Very urgent need for rare blood group support.", 7],
  ["Shawon Ahmed", "01910000009", "A+", "Hospital asked us to arrange one donor by noon.", 8],
  ["Tasrifa Noor", "01910000010", "O+", "Need donor support near Badda today.", 9],
  ["Jahidul Islam", "01910000011", "B+", "Family is searching for a B+ donor quickly.", 10],
  ["Rumana Yasmin", "01910000012", "A-", "One unit needed for surgery prep.", 11],
  ["Arafat Karim", "01910000013", "O-", "Urgent blood requirement for trauma care.", 12],
  ["Nazia Rahman", "01910000014", "AB+", "Hospital requested an AB+ donor this afternoon.", 13],
  ["Saiful Bari", "01910000015", "B-", "Please help arrange a donor around Tejgaon.", 14],
  ["Jui Akter", "01910000016", "O+", "Need an O+ donor around Motijheel.", 15],
];

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
  }),
);

const requests = requestBlueprints.map(([requesterName, requesterPhone, bloodGroup, message, donorIndex]) => ({
  requesterName,
  requesterPhone,
  bloodGroup,
  message,
  donorId: donors[donorIndex]!.id,
}));

async function main() {
  await prisma.$executeRaw`DELETE FROM "requests"`;

  await prisma.$executeRaw`DELETE FROM "donors"`;

  for (const donor of donors) {
    await prisma.$executeRaw`
      INSERT INTO "donors" (
        "id",
        "name",
        "phone",
        "email",
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
        ${donor.bloodGroup},
        ${donor.area},
        ${donor.lastDonated},
        ST_SetSRID(ST_MakePoint(${donor.longitude}, ${donor.latitude}), 4326),
        NOW(),
        NOW()
      )
    `;
  }

  await prisma.request.createMany({ data: requests });

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
