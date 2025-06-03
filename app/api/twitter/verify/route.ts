import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Next.jsの動的レンダリングを強制
export const dynamic = 'force-dynamic';

// Supabaseクライアントを初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TwitterApiCredentials {
  api_key: string;
  api_key_secret: string;
  access_token: string;
  access_token_secret: string;
}

// RFC 3986準拠のパーセントエンコード
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, function(c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

// OAuth 1.0a署名を生成する正しい実装
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  credentials: TwitterApiCredentials
): string {
  // パラメータをソートしてエンコード
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  // 署名ベース文字列を作成
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  
  // 署名キーを作成
  const signingKey = `${percentEncode(credentials.api_key_secret)}&${percentEncode(credentials.access_token_secret)}`;
  
  // HMAC-SHA1で署名を生成
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

// OAuth 1.0aヘッダーを生成
function generateOAuthHeader(
  method: string,
  url: string,
  params: Record<string, string>,
  credentials: TwitterApiCredentials
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.api_key,
    oauth_token: credentials.access_token,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0'
  };

  // 全パラメータを結合
  const allParams = { ...oauthParams, ...params };

  // 署名を生成
  const signature = generateOAuthSignature(method, url, allParams, credentials);
  oauthParams.oauth_signature = signature;

  // Authorizationヘッダーを構築
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // ユーザーのX API設定を取得
    const { data: apiSettings, error: settingsError } = await supabase
      .from('x_api_settings')
      .select('api_key, api_key_secret, access_token, access_token_secret, is_connected')
      .eq('user_id', userId)
      .single();

    if (settingsError || !apiSettings) {
      console.error('Settings error:', settingsError);
      return NextResponse.json(
        { error: 'X API設定が見つかりません' },
        { status: 404 }
      );
    }

    // 必要な認証情報があるかチェック
    if (!apiSettings.api_key || !apiSettings.api_key_secret || 
        !apiSettings.access_token || !apiSettings.access_token_secret) {
      return NextResponse.json(
        { error: '必要なX API認証情報が不足しています' },
        { status: 400 }
      );
    }

    const credentials: TwitterApiCredentials = {
      api_key: apiSettings.api_key,
      api_key_secret: apiSettings.api_key_secret,
      access_token: apiSettings.access_token,
      access_token_secret: apiSettings.access_token_secret,
    };

    // X API v2のユーザー情報取得エンドポイント（接続テスト用）
    const twitterApiUrl = 'https://api.twitter.com/2/users/me';

    // OAuth 1.0aヘッダーを生成
    const authHeader = generateOAuthHeader('GET', twitterApiUrl, {}, credentials);

    console.log('Testing connection to Twitter API v2...');
    console.log('URL:', twitterApiUrl);

    // X APIにリクエストを送信
    const response = await fetch(twitterApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    const responseData = await response.json();

    console.log('Twitter API verification response status:', response.status);
    console.log('Twitter API verification response data:', responseData);

    if (!response.ok) {
      console.error('X API verification error:', responseData);
      return NextResponse.json(
        { 
          success: false,
          error: 'X API認証に失敗しました', 
          details: responseData.errors || responseData.detail || responseData,
          status: response.status
        },
        { status: response.status }
      );
    }

    // 成功レスポンス
    return NextResponse.json({
      success: true,
      user: responseData.data,
    });

  } catch (error: any) {
    console.error('Twitter verification API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error' 
      },
      { status: 500 }
    );
  }
} 