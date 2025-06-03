"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { PlusCircle, Calendar, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    scheduled: 0,
    published: 0,
    draft: 0,
    failed: 0,
  });

  useEffect(() => {
    async function fetchPosts() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("scheduled_for", { ascending: true });

        if (error) {
          console.error("Error fetching posts:", error);
          return;
        }

        setPosts(data || []);

        // Calculate stats
        const newStats = {
          scheduled: 0,
          published: 0,
          draft: 0,
          failed: 0,
        };

        (data || []).forEach((post) => {
          if (post.status in newStats) {
            newStats[post.status as keyof typeof newStats]++;
          }
        });

        setStats(newStats);
      } catch (error) {
        console.error("Error in fetchPosts:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPosts();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <CheckCircle2 className="mr-1 h-3 w-3" />Published
        </span>;
      case "scheduled":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          <Clock className="mr-1 h-3 w-3" />Scheduled
        </span>;
      case "draft":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100">
          <Calendar className="mr-1 h-3 w-3" />Draft
        </span>;
      case "failed":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
          <AlertTriangle className="mr-1 h-3 w-3" />Failed
        </span>;
      default:
        return null;
    }
  };

  function truncateContent(content: string, maxLength: number = 100) {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  }

  function formatScheduleTime(dateString: string) {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Link href="/dashboard/create">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Scheduled Posts
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduled}</div>
            <p className="text-xs text-muted-foreground">
              Posts waiting to be published
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Published Posts
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
            <p className="text-xs text-muted-foreground">
              Successfully published posts
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Draft Posts
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
            <p className="text-xs text-muted-foreground">
              Saved drafts
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Failed Posts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">
              Posts that failed to publish
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : posts.filter(post => post.status === 'scheduled').length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {posts
                .filter(post => post.status === 'scheduled')
                .map((post) => (
                  <Link href={`/dashboard/edit/${post.id}`} key={post.id}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between">
                          {getStatusBadge(post.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatScheduleTime(post.scheduled_for)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <p className="text-sm">{truncateContent(post.content)}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No upcoming posts</CardTitle>
                <CardDescription className="mb-4">
                  You don't have any scheduled posts. Create your first post now.
                </CardDescription>
                <Link href="/dashboard/create">
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Post
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="past" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : posts.filter(post => post.status === 'published' || post.status === 'failed').length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {posts
                .filter(post => post.status === 'published' || post.status === 'failed')
                .map((post) => (
                  <Link href={`/dashboard/edit/${post.id}`} key={post.id}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between">
                          {getStatusBadge(post.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatScheduleTime(post.scheduled_for)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <p className="text-sm">{truncateContent(post.content)}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No published posts</CardTitle>
                <CardDescription className="mb-4">
                  You don't have any published posts yet.
                </CardDescription>
                <Link href="/dashboard/create">
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Post
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="draft" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : posts.filter(post => post.status === 'draft').length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {posts
                .filter(post => post.status === 'draft')
                .map((post) => (
                  <Link href={`/dashboard/edit/${post.id}`} key={post.id}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between">
                          {getStatusBadge(post.status)}
                          <span className="text-xs text-muted-foreground">
                            Last updated: {formatScheduleTime(post.updated_at)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <p className="text-sm">{truncateContent(post.content)}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No draft posts</CardTitle>
                <CardDescription className="mb-4">
                  You don't have any drafts saved. Create a draft now.
                </CardDescription>
                <Link href="/dashboard/create">
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Post
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}