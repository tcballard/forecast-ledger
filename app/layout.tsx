import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Forecast Ledger — Predictions with a paper trail',description:'An evidence-led forecasting lab. Inspect probabilities, review sources, preserve revisions and measure outcomes.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
