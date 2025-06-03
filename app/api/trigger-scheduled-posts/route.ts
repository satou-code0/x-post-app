import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Supabaseクライアントを初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('Triggering scheduled post processor...');

    // Supabase Edge Functionを呼び出し
    const { data, error } = await supabase.functions.invoke('scheduled-post-processor', {
      body: {},
    });

    if (error) {
      console.error('Edge Function error:', error);
      return NextResponse.json(
        { 
          error: 'Edge Function failed', 
          details: error 
        },
        { status: 500 }
      );
    }

    console.log('Edge Function response:', data);

    return NextResponse.json({
      success: true,
      message: 'Scheduled post processor triggered successfully',
      result: data
    });

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// 手動テスト用のGETエンドポイント
export async function GET() {
  return NextResponse.json({
    message: 'Scheduled post processor API endpoint',
    usage: 'Send POST request to trigger the processor'
  });
} 