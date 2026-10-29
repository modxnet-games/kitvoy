export function validateAdminCredentials(
  username: string,
  password: string,
): boolean {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  if (!envUser || !envPass) {
    return false;
  }

  return username === envUser && password === envPass;
}
