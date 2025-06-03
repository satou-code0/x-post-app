"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { CalendarIcon, Clock, AlertTriangle, Settings, Check, X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { postToTwitter } from "@/lib/x-api";

export default function CreatePostPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("12:00");
  const [isLoading, setIsLoading] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [xApiConnected, setXApiConnected] = useState<boolean | null>(null);
  const [isCheckingApi, setIsCheckingApi] = useState(true);

  // Generate time options
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const formattedHour = hour.toString().padStart(2, "0");
        const formattedMinute = minute.toString().padStart(2, "0");
        options.push(`${formattedHour}:${formattedMinute}`);
      }
    }
    return options;
  };

  useEffect(() => {
    async function initializeData() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      
      // プロフィールの存在を確認し、なければ作成
      await ensureProfileExists(data.user);
      
      // X API設定状況を確認
      await checkXApiConnection(data.user.id);

      // X API設定のリアルタイム監視を開始
      setupRealtimeSubscription(data.user.id);
    }
    
    initializeData();

    // クリーンアップ関数でリアルタイム監視を停止
    return () => {
      supabase.removeAllChannels();
    };
  }, [router]);

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
        } else {
          console.log("Profile created successfully");
        }
      } else if (checkError) {
        console.error("Error checking profile:", checkError);
      }
    } catch (error) {
      console.error("Error in ensureProfileExists:", error);
    }
  }

  // X API接続状況を確認する関数
  async function checkXApiConnection(userId: string) {
    try {
      setIsCheckingApi(true);
      const { data, error } = await supabase
        .from("x_api_settings")
        .select("is_connected, api_key, api_key_secret")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error checking API settings:", error);
        setXApiConnected(false);
        return;
      }

      if (data) {
        // API Keyが設定されており、接続済みの場合
        setXApiConnected(data.is_connected && !!data.api_key && !!data.api_key_secret);
      } else {
        // 設定が存在しない場合
        setXApiConnected(false);
      }
    } catch (error) {
      console.error("Error in checkXApiConnection:", error);
      setXApiConnected(false);
    } finally {
      setIsCheckingApi(false);
    }
  }

  // X API設定のリアルタイム監視を設定
  function setupRealtimeSubscription(userId: string) {
    const channel = supabase
      .channel('x_api_settings_create_page')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'x_api_settings',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('X API settings changed on create page:', payload);
          // 設定が変更されたら状態を再確認
          checkXApiConnection(userId);
        }
      )
      .subscribe();

    return channel;
  }

  useEffect(() => {
    setCharacterCount(content.length);
  }, [content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (newContent.length <= 280) {
      setContent(newContent);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!user || !content.trim()) return;

    try {
      setIsLoading(true);

      // Create a scheduled date from the selected date and time
      let scheduledDate = new Date();
      if (date) {
        scheduledDate = new Date(date);
        const [hours, minutes] = time.split(":").map(Number);
        scheduledDate.setHours(hours, minutes);
      }

      const { data, error } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          content,
          scheduled_for: scheduledDate.toISOString(),
          status: "draft",
        },
      ]).select();

      if (error) {
        throw error;
      }

      toast({
        title: "Post saved as draft",
        description: "You can edit this post later.",
      });

      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save draft",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!user || !content.trim() || !date) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields.",
      });
      return;
    }

    // X API接続確認
    if (!xApiConnected) {
      toast({
        variant: "destructive",
        title: "X API not configured",
        description: "Please configure your X API settings first.",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Create a scheduled date from the selected date and time
      const scheduledDate = new Date(date);
      const [hours, minutes] = time.split(":").map(Number);
      scheduledDate.setHours(hours, minutes);

      // Check if the scheduled date is in the past
      if (scheduledDate.getTime() < Date.now()) {
        toast({
          variant: "destructive",
          title: "Invalid schedule time",
          description: "Please select a future date and time.",
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          content,
          scheduled_for: scheduledDate.toISOString(),
          status: "scheduled",
        },
      ]).select();

      if (error) {
        throw error;
      }

      toast({
        title: "Post scheduled",
        description: `Your post will be published ${format(scheduledDate, "PPPp")}`,
      });

      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to schedule post",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostNow = async () => {
    if (!user || !content.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please enter your post content.",
      });
      return;
    }

    // X API接続確認
    if (!xApiConnected) {
      toast({
        variant: "destructive",
        title: "X API not configured",
        description: "Please configure your X API settings first.",
      });
      return;
    }

    try {
      setIsLoading(true);

      // 現在時刻で即座に投稿
      const now = new Date();

      // まずデータベースに投稿を記録
      const { data: postData, error } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          content,
          scheduled_for: now.toISOString(),
          status: "published",
          published: true, // publishedフィールドもtrueに設定
        },
      ]).select().single();

      if (error) {
        throw error;
      }

      // 実際のX API投稿を試行
      try {
        // X API投稿処理を実行
        const twitterResult = await postToTwitter({
          content: content,
          userId: user.id
        });
        
        if (twitterResult.success) {
          console.log("投稿がX APIに送信されました:", {
            postId: postData.id,
            tweetId: twitterResult.tweetId,
            content: content,
            timestamp: now.toISOString()
          });

          // 投稿IDがある場合はデータベースに保存
          if (twitterResult.tweetId) {
            await supabase
              .from("posts")
              .update({ 
                media_urls: [twitterResult.tweetId] // tweetIDを一時的にmedia_urlsに保存
              })
              .eq("id", postData.id);
          }

          toast({
            title: "投稿が完了しました！",
            description: "あなたの投稿がX（Twitter）に公開されました。",
          });
        } else {
          throw new Error(twitterResult.error || 'X投稿に失敗しました');
        }
      } catch (apiError: any) {
        // X API投稿に失敗した場合、データベースの状態を更新
        console.error("X API投稿エラー:", apiError);
        
        await supabase
          .from("posts")
          .update({ 
            status: "failed",
            published: false 
          })
          .eq("id", postData.id);

        toast({
          variant: "destructive",
          title: "X投稿に失敗しました",
          description: "データベースには保存されましたが、Xへの投稿に失敗しました。",
        });
        
        return;
      }

      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "投稿に失敗しました",
        description: error.message || "予期しないエラーが発生しました。",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Post</h1>
        {/* X API接続状況表示 */}
        {isCheckingApi ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
            <span className="text-sm text-muted-foreground">Checking API status...</span>
          </div>
        ) : xApiConnected ? (
          <Badge variant="default" className="bg-green-500">
            <Check className="h-3 w-3 mr-1" />
            X API Connected
          </Badge>
        ) : (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            X API Not Connected
          </Badge>
        )}
      </div>

      {/* X API未設定の場合の警告 */}
      {!isCheckingApi && !xApiConnected && (
        <Alert className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <div className="flex items-center justify-between">
              <span>
                X API is not configured. You can save drafts, but posts won't be published automatically.
              </span>
              <Link href="/dashboard/settings">
                <Button variant="outline" size="sm" className="ml-4 h-8">
                  <Settings className="h-3 w-3 mr-1" />
                  Configure API
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Compose your post</CardTitle>
          <CardDescription>
            Write your post and schedule it for publication on X.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="What's happening?"
              className="resize-none min-h-[150px]"
              value={content}
              onChange={handleContentChange}
            />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                Character count: {characterCount}/280
              </span>
              <div
                className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium",
                  characterCount > 280
                    ? "border-red-500 text-red-500"
                    : characterCount > 250
                    ? "border-yellow-500 text-yellow-500"
                    : "border-green-500 text-green-500"
                )}
              >
                {280 - characterCount}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule for</label>
            <div className="flex space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal flex-1",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="w-32">
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {generateTimeOptions().map((timeOption) => (
                    <SelectItem key={timeOption} value={timeOption}>
                      {timeOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleSaveAsDraft}
            disabled={!content.trim() || isLoading}
          >
            Save as Draft
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePostNow}
              disabled={
                !content.trim() || 
                isLoading || 
                characterCount > 280 ||
                !xApiConnected
              }
              className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
            >
              {isLoading ? "投稿中..." : "今すぐ投稿"}
            </Button>
            <Button
              onClick={handleSchedulePost}
              disabled={
                !content.trim() || 
                !date || 
                isLoading || 
                characterCount > 280
              }
            >
              {isLoading ? "Scheduling..." : "Schedule Post"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}