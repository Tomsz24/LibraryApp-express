export interface User {
  id: string;
  email: string;
  name: string;
  surname: string;
  avatar_url?: string | null;
  isAdmin?: boolean;
  password?: string;
}
