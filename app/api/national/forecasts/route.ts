import { append } from '@/lib/national-api';
export async function POST(request:Request){return append(request,'forecast');}
