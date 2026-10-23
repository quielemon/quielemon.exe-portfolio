import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title:"QA.EXE — Quielemon Weversson | QA & Development",
 description:"Portfólio de Quielemon Weversson: Quality Assurance, automação, desenvolvimento e o caminho para Game Dev. Conheça o QA Flow Studio e minha trajetória.",
 robots:{index:false,follow:false},
 icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>}
