using System;
using Xunit;
using FluentAssertions;
using IzinYonetimi.Entities;

namespace IzinYonetimi.Tests.LeaveBalances
{
    public class LeaveBalanceEntityTests
    {
        [Fact]
        public void LeaveBalance_ShouldBeCreatable()
        {
            // Act
            var entity = new LeaveBalance();

            // Assert
            entity.Should().NotBeNull();
        }

        [Fact]
        public void LeaveBalance_ShouldHaveDefaultValues()
        {
            // Act
            var entity = new LeaveBalance();

            // Assert
            entity.Id.Should().Be(default(long));

        }


    }
}
