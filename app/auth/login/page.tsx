import { redirect } from "next/navigation";

// La ruta oficial de login es /login
export default function Page() {
  redirect("/login");
}
