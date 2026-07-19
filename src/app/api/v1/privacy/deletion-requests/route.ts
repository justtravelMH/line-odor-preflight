import {NextResponse} from 'next/server';export async function POST(){return NextResponse.json({status:'PENDING',requestId:crypto.randomUUID()},{status:202})}
