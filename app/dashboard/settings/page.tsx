"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { testXApiConnection } from "@/lib/x-api";
import { Eye, EyeOff, Check, X, AlertCircle, Key, Link as LinkIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface XApiSettings {
  id?: string;
  api_key?: string;
  api_key_secret?: string;
  access_token?: string;
  access_token_secret?: string;
  bearer_token?: string;
  is_connected: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<XApiSettings>({ is_connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    api_key_secret: false,
    access_token_secret: false,
    bearer_token: false
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // まずプロフィールの存在を確認し、なければ作成
      await ensureProfileExists(userData.user);

      const { data, error } = await supabase
        .from("x_api_settings")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error("Error fetching settings:", error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error("Error in fetchSettings:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // プロフィールが存在することを確認し、なければ作成する関数
  async function ensureProfileExists(user: any) {
    try {
      // プロフィールが既に存在するかチェック
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // プロフィールが存在しない場合、作成する
        console.log("Profile not found, creating new profile...");
        
        // ユーザー名を生成（emailのユーザー部分を使用）
        const username = user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
        
        const { error: insertError } = await supabase
          .from("profiles")
          .insert([
            {
              id: user.id,
              username: username,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              avatar_url: user.user_metadata?.avatar_url || null,
              x_handle: null,
            },
          ]);

        if (insertError) {
          console.error("Error creating profile:", insertError);
          throw new Error("Failed to create user profile");
        }
        
        console.log("Profile created successfully");
      } else if (checkError) {
        console.error("Error checking profile:", checkError);
        throw checkError;
      }
    } catch (error) {
      console.error("Error in ensureProfileExists:", error);
      throw error;
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true);

      // ユーザー情報を取得
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // プロファイルが存在することを確認
      await ensureProfileExists(userData.user);

      // 設定データを準備
      const settingsData = {
        user_id: userData.user.id,
        api_key: settings.api_key || null,
        api_key_secret: settings.api_key_secret || null,
        access_token: settings.access_token || null,
        access_token_secret: settings.access_token_secret || null,
        bearer_token: settings.bearer_token || null,
        is_connected: false, // 保存時はまず未接続状態にする
      };

      let result: any;
      if (settings.id) {
        // 更新
        result = await supabase
          .from("x_api_settings")
          .update(settingsData)
          .eq("id", settings.id)
          .select()
          .single();
      } else {
        // 新規作成
        result = await supabase
          .from("x_api_settings")
          .insert([settingsData])
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      setSettings(result.data);
      toast({
        title: "Settings Saved",
        description: "X API settings have been saved successfully.",
      });

      // 保存成功後、少し遅延してから接続テストを自動実行
      setTimeout(() => {
        if (result && result.data && result.data.api_key && result.data.api_key_secret) {
          handleTestConnection();
        }
      }, 500);

    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Failed to save settings.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setIsTesting(true);
      
      // 必須フィールドのバリデーション
      if (!settings.api_key || !settings.api_key_secret) {
        toast({
          variant: "destructive",
          title: "Connection Test Failed",
          description: "API Key and API Key Secret are required.",
        });
        return;
      }

      // ユーザー情報を取得
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // 実際のX API接続テストを実行
      const testResult = await testXApiConnection(userData.user.id);
      
      if (testResult.success) {
        // 接続成功時の処理
        const { data, error } = await supabase
          .from("x_api_settings")
          .update({ is_connected: true })
          .eq("user_id", userData.user.id)
          .select()
          .single();

        if (error) throw error;

        // ローカル状態も更新
        setSettings(prev => ({ ...prev, is_connected: true }));
        
        toast({
          title: "Connection Test Successful", 
          description: "Successfully connected to X API.",
        });

        console.log("Connection test completed, settings updated:", data);
      } else {
        // 接続失敗時の処理
        throw new Error(testResult.error || 'X API接続テストに失敗しました');
      }

    } catch (error: any) {
      console.error("Error testing connection:", error);
      
      // 失敗時はis_connectedをfalseに更新
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("x_api_settings")
          .update({ is_connected: false })
          .eq("user_id", userData.user.id);
      }
      
      setSettings(prev => ({ ...prev, is_connected: false }));
      
      toast({
        variant: "destructive",
        title: "Connection Test Failed",
        description: error.message || "Failed to connect to X API.",
      });
    } finally {
      setIsTesting(false);
    }
  }

  function toggleShowSecret(field: keyof typeof showSecrets) {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your X (Twitter) API settings to enable posting functionality.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                X API Configuration
              </CardTitle>
              <CardDescription>
                Enter your X API credentials to enable automatic posting.
              </CardDescription>
            </div>
            {settings.is_connected ? (
              <Badge variant="default" className="bg-green-500">
                <Check className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <X className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your API credentials are stored securely and encrypted. Never share these credentials with anyone.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type="text"
                placeholder="Enter your X API Key"
                value={settings.api_key || ""}
                onChange={(e) => setSettings(prev => ({ ...prev, api_key: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="api_key_secret">API Key Secret *</Label>
              <div className="relative">
                <Input
                  id="api_key_secret"
                  type={showSecrets.api_key_secret ? "text" : "password"}
                  placeholder="Enter your X API Key Secret"
                  value={settings.api_key_secret || ""}
                  onChange={(e) => setSettings(prev => ({ ...prev, api_key_secret: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => toggleShowSecret('api_key_secret')}
                >
                  {showSecrets.api_key_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="access_token">Access Token (Optional)</Label>
              <Input
                id="access_token"
                type="text"
                placeholder="Enter your X Access Token"
                value={settings.access_token || ""}
                onChange={(e) => setSettings(prev => ({ ...prev, access_token: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="access_token_secret">Access Token Secret (Optional)</Label>
              <div className="relative">
                <Input
                  id="access_token_secret"
                  type={showSecrets.access_token_secret ? "text" : "password"}
                  placeholder="Enter your X Access Token Secret"
                  value={settings.access_token_secret || ""}
                  onChange={(e) => setSettings(prev => ({ ...prev, access_token_secret: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => toggleShowSecret('access_token_secret')}
                >
                  {showSecrets.access_token_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bearer_token">Bearer Token (Optional)</Label>
              <div className="relative">
                <Input
                  id="bearer_token"
                  type={showSecrets.bearer_token ? "text" : "password"}
                  placeholder="Enter your X Bearer Token"
                  value={settings.bearer_token || ""}
                  onChange={(e) => setSettings(prev => ({ ...prev, bearer_token: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => toggleShowSecret('bearer_token')}
                >
                  {showSecrets.bearer_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTestConnection} 
              disabled={isTesting || !settings.api_key || !settings.api_key_secret}
            >
              {isTesting ? "Testing..." : "Test Connection"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            How to Get X API Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Step 1: Create a X Developer Account</h4>
            <p className="text-sm text-muted-foreground">
              Visit <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                developer.twitter.com
              </a> and apply for a developer account.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Step 2: Create a New App</h4>
            <p className="text-sm text-muted-foreground">
              Once approved, create a new app in the X Developer Portal to get your API keys.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Step 3: Generate Access Tokens</h4>
            <p className="text-sm text-muted-foreground">
              In your app settings, generate access tokens for posting functionality.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Step 4: Configure Permissions</h4>
            <p className="text-sm text-muted-foreground">
              Make sure your app has "Read and Write" permissions to post tweets.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 