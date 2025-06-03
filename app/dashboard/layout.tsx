"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/header";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  CalendarDays,
  LayoutDashboard,
  Settings,
  PlusCircle,
  BarChart3,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [xApiConnected, setXApiConnected] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      
      if (!data.user) {
        router.push('/login');
        return;
      }
      
      setUser(data.user);
      
      // プロフィールの存在を確認し、なければ作成
      await ensureProfileExists(data.user);
      
      // X API設定状況を確認
      await checkXApiConnection(data.user.id);
      
      // X API設定のリアルタイム監視を開始
      setupRealtimeSubscription(data.user.id);
      
      setLoading(false);
    }
    
    getUser();

    // クリーンアップ関数でリアルタイム監視を停止
    return () => {
      supabase.removeAllChannels();
    };
  }, [router]);

  // X API設定のリアルタイム監視を設定
  function setupRealtimeSubscription(userId: string) {
    const channel = supabase
      .channel('x_api_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'x_api_settings',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('X API settings changed:', payload);
          // 設定が変更されたら状態を再確認
          checkXApiConnection(userId);
        }
      )
      .subscribe();

    return channel;
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
        const connected = data.is_connected && !!data.api_key && !!data.api_key_secret;
        console.log("X API connection status:", connected, data);
        setXApiConnected(connected);
      } else {
        console.log("No X API settings found");
        setXApiConnected(false);
      }
    } catch (error) {
      console.error("Error in checkXApiConnection:", error);
      setXApiConnected(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-64 border-r bg-card">
          <nav className="p-4 space-y-1">
            <NavItem 
              href="/dashboard" 
              icon={<LayoutDashboard className="mr-2 h-4 w-4" />}
              isActive={pathname === "/dashboard"}
            >
              Dashboard
            </NavItem>
            <NavItem 
              href="/dashboard/calendar" 
              icon={<CalendarDays className="mr-2 h-4 w-4" />}
              isActive={pathname === "/dashboard/calendar"}
            >
              Calendar
            </NavItem>
            <NavItem 
              href="/dashboard/analytics" 
              icon={<BarChart3 className="mr-2 h-4 w-4" />}
              isActive={pathname === "/dashboard/analytics"}
            >
              Analytics
            </NavItem>
            <NavItem 
              href="/dashboard/settings" 
              icon={<Settings className="mr-2 h-4 w-4" />}
              isActive={pathname === "/dashboard/settings"}
              badge={
                xApiConnected === false ? (
                  <Badge variant="destructive" className="ml-auto text-xs">
                    <AlertTriangle className="h-2 w-2 mr-1" />
                    Setup
                  </Badge>
                ) : xApiConnected === true ? (
                  <Badge variant="default" className="ml-auto bg-green-500 text-xs">
                    ✓
                  </Badge>
                ) : null
              }
            >
              Settings
            </NavItem>
            
            <Separator className="my-4" />
            
            <Button href="/dashboard/create" className="w-full justify-start" variant="default">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Post
            </Button>

            {/* X API接続状況を下部に表示 */}
            {xApiConnected !== null && (
              <>
                <Separator className="my-4" />
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>X API Status</span>
                    {xApiConnected ? (
                      <Badge variant="default" className="bg-green-500 text-xs">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            )}
          </nav>
        </aside>
        
        <main className="flex-1 p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

interface ButtonProps extends React.ComponentPropsWithoutRef<"a"> {
  variant?: "default" | "ghost";
  children: React.ReactNode;
  icon?: React.ReactNode;
}

function Button({ href, className, variant = "ghost", children, icon, ...props }: ButtonProps) {
  return (
    <Link
      href={href || "#"}
      className={cn(
        "flex items-center py-2 px-3 rounded-md text-sm font-medium transition-colors",
        variant === "default" 
          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}

interface NavItemProps {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  isActive?: boolean;
  badge?: React.ReactNode;
}

function NavItem({ href, children, icon, isActive, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center py-2 px-3 rounded-md text-sm font-medium transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
        isActive && "bg-accent text-foreground"
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge}
    </Link>
  );
}