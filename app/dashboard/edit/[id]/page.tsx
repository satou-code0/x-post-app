"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { CalendarIcon, Clock, Trash2 } from "lucide-react";
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

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [post, setPost] = useState<any>(null);
  const [content, setContent] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("12:00");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [characterCount, setCharacterCount] = useState(0);
  const [user, setUser] = useState<any>(null);

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
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);

      // Fetch the post data
      if (params.id) {
        const { data: postData, error } = await supabase
          .from("posts")
          .select("*")
          .eq("id", params.id)
          .eq("user_id", data.user.id)
          .single();

        if (error || !postData) {
          toast({
            variant: "destructive",
            title: "Post not found",
            description: "The post you're looking for doesn't exist or you don't have permission to view it.",
          });
          router.push("/dashboard");
          return;
        }

        setPost(postData);
        setContent(postData.content);
        setCharacterCount(postData.content.length);

        // Set the date and time
        const scheduledDate = new Date(postData.scheduled_for);
        setDate(scheduledDate);
        const hours = scheduledDate.getHours().toString().padStart(2, "0");
        const minutes = scheduledDate.getMinutes().toString().padStart(2, "0");
        setTime(`${hours}:${minutes}`);
      }

      setIsFetching(false);
    }
    
    getUser();
  }, [params.id, router, toast]);

  useEffect(() => {
    setCharacterCount(content.length);
  }, [content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (newContent.length <= 280) {
      setContent(newContent);
    }
  };

  const handleUpdate = async (status: "draft" | "scheduled") => {
    if (!user || !content.trim() || !date || !post) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields.",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Create a scheduled date from the selected date and time
      const scheduledDate = new Date(date);
      const [hours, minutes] = time.split(":").map(Number);
      scheduledDate.setHours(hours, minutes);

      // Check if the scheduled date is in the past and status is scheduled
      if (status === "scheduled" && scheduledDate.getTime() < Date.now()) {
        toast({
          variant: "destructive",
          title: "Invalid schedule time",
          description: "Please select a future date and time.",
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("posts")
        .update({
          content,
          scheduled_for: scheduledDate.toISOString(),
          status,
        })
        .eq("id", post.id)
        .eq("user_id", user.id)
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: status === "scheduled" ? "Post scheduled" : "Draft updated",
        description: status === "scheduled" 
          ? `Your post will be published ${format(scheduledDate, "PPPp")}` 
          : "Your draft has been saved.",
      });

      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !post) return;

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Post deleted",
        description: "The post has been permanently deleted.",
      });

      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold">Post not found</h1>
        <p className="text-muted-foreground mt-2">The post you're looking for doesn't exist or you don't have permission to view it.</p>
        <Button className="mt-6" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{post.status === "draft" ? "Edit Draft" : "Edit Scheduled Post"}</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this post. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit your post</CardTitle>
          <CardDescription>
            Make changes to your post and update its schedule.
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
            <div className="flex justify-end">
              <span className={cn(
                "text-sm",
                characterCount > 260 ? "text-orange-500" : "text-muted-foreground",
                characterCount >= 280 ? "text-destructive" : ""
              )}>
                {characterCount}/280
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Schedule for</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1">
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select time" />
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
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => handleUpdate("draft")} 
            disabled={isLoading || !content.trim()}
          >
            Update as Draft
          </Button>
          <Button 
            onClick={() => handleUpdate("scheduled")} 
            disabled={isLoading || !content.trim() || !date}
          >
            <Clock className="mr-2 h-4 w-4" />
            Update Schedule
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}