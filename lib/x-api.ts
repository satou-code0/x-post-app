import { supabase } from './supabase';

export interface TwitterApiCredentials {
  api_key: string;
  api_key_secret: string;
  access_token?: string;
  access_token_secret?: string;
  bearer_token?: string;
}

export interface PostToTwitterOptions {
  content: string;
  userId: string;
}

/**
 * ユーザーのX API設定を取得する
 */
export async function getUserXApiCredentials(userId: string): Promise<TwitterApiCredentials | null> {
  try {
    const { data, error } = await supabase
      .from('x_api_settings')
      .select('api_key, api_key_secret, access_token, access_token_secret, bearer_token, is_connected')
      .eq('user_id', userId)
      .eq('is_connected', true)
      .single();

    if (error || !data) {
      console.error('X API設定の取得に失敗:', error);
      return null;
    }

    return {
      api_key: data.api_key,
      api_key_secret: data.api_key_secret,
      access_token: data.access_token,
      access_token_secret: data.access_token_secret,
      bearer_token: data.bearer_token,
    };
  } catch (error) {
    console.error('X API設定の取得中にエラー:', error);
    return null;
  }
}

/**
 * X（Twitter）に投稿する
 * サーバーサイドAPIエンドポイントを呼び出して実際にX APIに投稿します
 */
export async function postToTwitter({ content, userId }: PostToTwitterOptions): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    // サーバーサイドのAPIエンドポイントを呼び出し
    const response = await fetch('/api/twitter/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        userId
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    if (result.success) {
      console.log('X投稿が成功しました:', result);
      return {
        success: true,
        tweetId: result.tweetId
      };
    } else {
      return {
        success: false,
        error: result.error || 'X投稿に失敗しました'
      };
    }

  } catch (error: any) {
    console.error('X投稿エラー:', error);
    return {
      success: false,
      error: error.message || 'X投稿中に予期しないエラーが発生しました'
    };
  }
}

/**
 * X API接続をテストする
 * サーバーサイドAPIエンドポイントを呼び出して実際のX APIに接続確認を行います
 */
export async function testXApiConnection(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // サーバーサイドのAPIエンドポイントを呼び出し
    const response = await fetch('/api/twitter/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    if (result.success) {
      console.log('X API接続テストが成功しました:', result);
      return {
        success: true
      };
    } else {
      return {
        success: false,
        error: result.error || 'X API接続テストに失敗しました'
      };
    }

  } catch (error: any) {
    console.error('X API接続テストエラー:', error);
    return {
      success: false,
      error: error.message || 'X API接続テスト中に予期しないエラーが発生しました'
    };
  }
} 