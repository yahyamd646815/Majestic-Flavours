import type { AppUser } from "@/types/inventory";

export const sampleUsers: AppUser[] = [
  {
    id: "user-1",
    name: "Yahya Mohammed",
    email: "yahyamd646815+admin@gmail.com",
    role: "admin",
  },
  {
    id: "user-2",
    name: "Yahya (Manager Account)",
    email: "yahyamd646815+manager@gmail.com",
    role: "manager",
  },
  {
    id: "user-3",
    name: "Yahya (Employee Account)",
    email: "yahyamd646815+employee@gmail.com",
    role: "employee",
  },
  {
    id: "user-4",
    name: "Yahya (Employee Account no1)",
    email: "yahyamd646815+employee1@gmail.com",
    role: "employee",
  },
  {
    id: "user-5",
    name: "Yahya (Employee account no2)",
    email: "yahyamd646815+employee2@gmail.com",
    role: "employee",
  }
];
// I (Yahya) removed some sample users to keep the code concise. You can add more users as needed.