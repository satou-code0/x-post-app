"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { format, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";

export default function CalendarPage() {
  const router = useRouter();
  const [date, setDate] = useState<Date>(new Date());
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDayPosts, setSelectedDayPosts] = useState<any[]>([]);

  // Function to generate the modifiers for calendar days
  function getPostDays() {
    return posts.map(post => new Date(post.scheduled_for));
  }

  useEffect(() => {
    async function fetchPosts() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", userData.user.id)
          .in("status", ["scheduled", "published"])
          .order("scheduled_for", { ascending: true });

        if (error) {
          console.error("Error fetching posts:", error);
          return;
        }

        setPosts(data || []);
      } catch (error) {
        console.error("Error in fetchPosts:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPosts();
  }, [router]);

  useEffect(() => {
    // Filter posts for the selected day
    const postsForSelectedDay = posts.filter(post => {
      const postDate = new Date(post.scheduled_for);
      return isSameDay(postDate, date);
    });

    // Sort by time
    postsForSelectedDay.sort((a, b) => {
      return new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime();
    });

    setSelectedDayPosts(postsForSelectedDay);
  }, [date, posts]);

  const handlePreviousMonth = () => {
    const previousMonth = new Date(date);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    setDate(previousMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(date);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setDate(nextMonth);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Calendar View</h1>
        <Link href="/dashboard/create">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Post Schedule</CardTitle>
              <div className="flex space-x-2">
                <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>
              View and manage your scheduled posts by date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => newDate && setDate(newDate)}
                className="rounded-md border"
                modifiers={{
                  hasPost: getPostDays()
                }}
                modifiersClassNames={{
                  hasPost: "bg-primary/20 text-foreground font-bold rounded-md"
                }}
                initialFocus
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Posts for {format(date, "MMMM d, yyyy")}
              </CardTitle>
              <CardDescription>
                {selectedDayPosts.length === 0
                  ? "No posts scheduled for this day"
                  : `${selectedDayPosts.length} post${selectedDayPosts.length !== 1 ? "s" : ""} scheduled`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDayPosts.length > 0 ? (
                <div className="space-y-4">
                  {selectedDayPosts.map((post) => (
                    <Link href={`/dashboard/edit/${post.id}`} key={post.id}>
                      <div className="p-3 border rounded-md hover:bg-accent transition-colors cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium">
                            {format(new Date(post.scheduled_for), "h:mm a")}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            post.status === 'published' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                          }`}>
                            {post.status === 'published' ? 'Published' : 'Scheduled'}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2">
                          {post.content.length > 100
                            ? `${post.content.substring(0, 100)}...`
                            : post.content}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">No posts for this day</p>
                  <Link href="/dashboard/create">
                    <Button size="sm">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Post
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}