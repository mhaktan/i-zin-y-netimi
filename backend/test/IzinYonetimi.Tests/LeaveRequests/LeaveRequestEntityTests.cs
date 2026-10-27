using System;
using Xunit;
using FluentAssertions;
using IzinYonetimi.Entities;

namespace IzinYonetimi.Tests.LeaveRequests
{
    public class LeaveRequestEntityTests
    {
        [Fact]
        public void LeaveRequest_ShouldBeCreatable()
        {
            // Act
            var entity = new LeaveRequest();

            // Assert
            entity.Should().NotBeNull();
        }

        [Fact]
        public void LeaveRequest_ShouldHaveDefaultValues()
        {
            // Act
            var entity = new LeaveRequest();

            // Assert
            entity.Id.Should().Be(default(long));

        }


    }
}
