import { adminClient, createConfirmedUser } from "./support/users";

export default async function globalSetup() {
  const admin = adminClient();
  const [a, b] = [await createConfirmedUser(admin, "a"), await createConfirmedUser(admin, "b")];
  process.env.E2E_USER_A = JSON.stringify(a);
  process.env.E2E_USER_B = JSON.stringify(b);
}
