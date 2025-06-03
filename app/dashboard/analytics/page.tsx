"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { supabase } from "@/lib/supabase";
import { subDays, format, startOfWeek, endOfWeek, eachDayOfInterval, isEqual, parseISO } from "date-fns";

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [chartData, setChartData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);

  // Chart colors
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  useEffect(() => {
    async function fetchPosts() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", userData.user.id);

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
  }, []);

  useEffect(() => {
    if (posts.length === 0) return;

    // Generate data for time period chart
    let startDate;
    let endDate = new Date();
    
    switch (selectedPeriod) {
      case "week":
        startDate = subDays(new Date(), 7);
        break;
      case "month":
        startDate = subDays(new Date(), 30);
        break;
      case "year":
        startDate = subDays(new Date(), 365);
        break;
      default:
        startDate = subDays(new Date(), 7);
    }

    // For week view, show each day
    if (selectedPeriod === "week") {
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());
      const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      const newChartData = daysInWeek.map(day => {
        const count = posts.filter(post => {
          const postDate = parseISO(post.scheduled_for);
          return isEqual(new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate()), 
                         new Date(day.getFullYear(), day.getMonth(), day.getDate()));
        }).length;
        
        return {
          name: format(day, "EEE"),
          posts: count
        };
      });
      
      setChartData(newChartData);
    } else {
      // For month and year, generate appropriate intervals
      const interval = selectedPeriod === "month" ? 5 : 30; // days per data point
      const dataPoints = [];
      
      for (let i = 0; i <= (selectedPeriod === "month" ? 30 : 360); i += interval) {
        const currentDate = subDays(new Date(), i);
        const prevDate = subDays(currentDate, interval);
        
        const count = posts.filter(post => {
          const postDate = new Date(post.scheduled_for);
          return postDate >= prevDate && postDate <= currentDate;
        }).length;
        
        dataPoints.unshift({
          name: selectedPeriod === "month" 
            ? format(currentDate, "MMM d") 
            : format(currentDate, "MMM"),
          posts: count
        });
      }
      
      setChartData(dataPoints.slice(0, selectedPeriod === "month" ? 6 : 12));
    }

    // Generate data for status pie chart
    const statusCounts = {
      draft: 0,
      scheduled: 0,
      published: 0,
      failed: 0
    };

    posts.forEach(post => {
      if (post.status in statusCounts) {
        statusCounts[post.status as keyof typeof statusCounts]++;
      }
    });

    const newStatusData = [
      { name: "Published", value: statusCounts.published },
      { name: "Scheduled", value: statusCounts.scheduled },
      { name: "Draft", value: statusCounts.draft },
      { name: "Failed", value: statusCounts.failed }
    ].filter(item => item.value > 0);

    setStatusData(newStatusData);
  }, [posts, selectedPeriod]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Published
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {posts.filter(post => post.status === "published").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {posts.filter(post => post.status === "scheduled").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Characters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {posts.length > 0
                ? Math.round(
                    posts.reduce((sum, post) => sum + post.content.length, 0) / posts.length
                  )
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="status">Status Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Post Activity</CardTitle>
                <div className="flex space-x-2">
                  <TabsList className="bg-muted h-9">
                    <TabsTrigger 
                      value="week" 
                      className={selectedPeriod === "week" ? "data-[state=active]:bg-background" : ""}
                      onClick={() => setSelectedPeriod("week")}
                    >
                      Week
                    </TabsTrigger>
                    <TabsTrigger 
                      value="month" 
                      className={selectedPeriod === "month" ? "data-[state=active]:bg-background" : ""}
                      onClick={() => setSelectedPeriod("month")}
                    >
                      Month
                    </TabsTrigger>
                    <TabsTrigger 
                      value="year" 
                      className={selectedPeriod === "year" ? "data-[state=active]:bg-background" : ""}
                      onClick={() => setSelectedPeriod("year")}
                    >
                      Year
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
              <CardDescription>
                The number of posts scheduled over time.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              <div className="h-[300px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%\" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: 'var(--foreground)' }}
                      />
                      <YAxis 
                        tick={{ fill: 'var(--foreground)' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          color: 'hsl(var(--foreground))'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="posts" 
                        name="Posts" 
                        fill="hsl(var(--chart-1))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No data available for this period</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Post Status Distribution</CardTitle>
              <CardDescription>
                Breakdown of your posts by current status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%\" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          color: 'hsl(var(--foreground))'
                        }}
                        formatter={(value) => [value, "Posts"]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}