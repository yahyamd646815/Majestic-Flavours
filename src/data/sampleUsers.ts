import type { AppUser } from "@/types/inventory";

export const sampleUsers: AppUser[] = [
  {
    id: "user-1",
    name: "Yahya Mohammed bin Subhan",
    email: "yahyamd646815+admin@gmail.com",
    role: "admin",
  },
  {
    id: "user-2",
    name: "Yahya bin Subhan",
    email: "yahyamd646815+manager@gmail.com",
    role: "manager",
  },
  {
    id: "user-3",
    name: "Yahya Mohammed",
    email: "yahyamd646815+employee@gmail.com",
    role: "employee",
  },
  {
    id: "user-4",
    name: "Mohammed Yahya",
    email: "yahyamd646815+employee1@gmail.com",
    role: "employee",
  },
];
// I (Yahya) removed some sample users to keep the code concise. You can add more users as needed.